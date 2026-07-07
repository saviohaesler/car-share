"use client";

import { useEffect } from "react";
import {
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";

// Web-Push-Abos liegen pro Auto unter cars/{carId}/pushSubscriptions/{uid}
// (nur für Mitglieder lesbar, siehe firestore.rules). Ein Dokument pro Nutzer,
// darin ein subs-Array mit einem Eintrag je Gerät.

export type PushEventType = "drive" | "fuel" | "reservation";

export interface StoredPushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

const PUSH_ENABLED_KEY = "pushEnabled";

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// iOS unterstützt Web Push nur in der installierten Home-Bildschirm-App
// (ab iOS 16.4) - im normalen Safari-Tab fehlt PushManager komplett.
export function isIosWithoutPwa(): boolean {
  if (typeof window === "undefined") return false;
  const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return isIos && !standalone;
}

export function isPushEnabledLocally(): boolean {
  return (
    isPushSupported() &&
    localStorage.getItem(PUSH_ENABLED_KEY) === "1" &&
    Notification.permission === "granted"
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function normalizeSubscription(sub: PushSubscription): StoredPushSub | null {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  // Bewusst nur die drei benötigten Felder (expirationTime wäre in
  // Firestore-Arrays als undefined/null nur Ballast und bricht arrayRemove)
  return {
    endpoint: json.endpoint,
    keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
  };
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

function subDocRef(carId: string, uid: string) {
  return doc(db, "cars", carId, "pushSubscriptions", uid);
}

async function writeSubToCar(carId: string, uid: string, stored: StoredPushSub) {
  await setDoc(
    subDocRef(carId, uid),
    { uid, subs: arrayUnion(stored), updatedAt: serverTimestamp() },
    { merge: true }
  );
}

// Aktiviert Push auf diesem Gerät und hinterlegt das Abo bei allen Autos.
// Muss aus einer Nutzer-Geste heraus aufgerufen werden (iOS-Anforderung).
export async function enablePush(carIds: string[], uid: string): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!publicKey) {
    throw new Error("Push ist nicht konfiguriert (VAPID-Key fehlt).");
  }

  // Permission zuerst - der Dialog braucht die Nutzer-Geste
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error(
      "Benachrichtigungen wurden nicht erlaubt. Bitte in den Geräte-Einstellungen für CarShare aktivieren."
    );
  }

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
  });
  const stored = normalizeSubscription(sub);
  if (!stored) throw new Error("Push-Abo konnte nicht erstellt werden.");

  await Promise.all(carIds.map((carId) => writeSubToCar(carId, uid, stored)));
  localStorage.setItem(PUSH_ENABLED_KEY, "1");
}

// Deaktiviert Push auf diesem Gerät und entfernt das Abo aus allen Autos
// (nur dieses Gerät - Abos anderer Geräte desselben Nutzers bleiben bestehen).
export async function disablePush(carIds: string[], uid: string): Promise<void> {
  localStorage.setItem(PUSH_ENABLED_KEY, "0");
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const stored = normalizeSubscription(sub);
  await sub.unsubscribe();
  if (!stored) return;
  await Promise.all(
    carIds.map((carId) =>
      setDoc(
        subDocRef(carId, uid),
        { uid, subs: arrayRemove(stored), updatedAt: serverTimestamp() },
        { merge: true }
      ).catch((e) => console.warn("Push-Abo konnte nicht entfernt werden:", e))
    )
  );
}

// Hält das Abo aktuell, wenn ein Auto besucht wird (deckt z. B. Autos ab,
// denen man erst nach dem Aktivieren des Schalters beigetreten ist).
// Max. einmal pro Tag und Gerät pro Auto, solange sich das Abo nicht ändert.
async function syncPushSubscriptionForCar(carId: string): Promise<void> {
  try {
    if (!isPushEnabledLocally()) return;
    const user = auth.currentUser;
    if (!user) return;
    const sub = await getCurrentSubscription();
    if (!sub) return;
    const stored = normalizeSubscription(sub);
    if (!stored) return;

    const throttleKey = `pushSync:${carId}`;
    try {
      const last = JSON.parse(localStorage.getItem(throttleKey) || "null");
      if (
        last &&
        last.endpoint === stored.endpoint &&
        Date.now() - last.at < 24 * 60 * 60 * 1000
      ) {
        return;
      }
    } catch {}

    await writeSubToCar(carId, user.uid, stored);
    localStorage.setItem(
      throttleKey,
      JSON.stringify({ endpoint: stored.endpoint, at: Date.now() })
    );
  } catch (e) {
    console.warn("Push-Sync fehlgeschlagen:", e);
  }
}

export function usePushSync(carId: string) {
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      if (u) syncPushSubscriptionForCar(carId);
    });
    return () => unsubscribe();
  }, [carId]);
}

// Benachrichtigt alle anderen Mitglieder des Autos (fire-and-forget, Fehler
// dürfen das Speichern des eigentlichen Eintrags nie beeinträchtigen).
export async function notifyCarMembers(params: {
  carId: string;
  carName: string;
  type: PushEventType;
  actorName: string;
  detail: string;
}): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) return;

    // Nur aktuelle Mitglieder benachrichtigen - Abo-Dokumente von
    // ausgetretenen Mitgliedern werden ignoriert
    const carSnap = await getDoc(doc(db, "cars", params.carId));
    const members: string[] = carSnap.exists() ? carSnap.data().members || [] : [];

    const snap = await getDocs(collection(db, "cars", params.carId, "pushSubscriptions"));
    const subscriptions: StoredPushSub[] = [];
    snap.forEach((d) => {
      if (d.id === user.uid || !members.includes(d.id)) return;
      const subs = d.data().subs;
      if (!Array.isArray(subs)) return;
      subs.forEach((s) => {
        if (s?.endpoint && s?.keys?.p256dh && s?.keys?.auth) {
          subscriptions.push({
            endpoint: s.endpoint,
            keys: { p256dh: s.keys.p256dh, auth: s.keys.auth },
          });
        }
      });
    });
    if (subscriptions.length === 0) return;

    const token = await user.getIdToken();
    await fetch("/api/notify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        type: params.type,
        carId: params.carId,
        carName: params.carName,
        actorName: params.actorName,
        detail: params.detail,
        subscriptions,
      }),
    });
  } catch (e) {
    console.warn("Benachrichtigung konnte nicht gesendet werden:", e);
  }
}
