import { NextRequest, NextResponse } from "next/server";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore, Firestore } from "firebase-admin/firestore";
import webpush from "web-push";
import { encodePolyline } from "../../../lib/polyline";

// Automatisches Fahrten-Tracking über SensorLogger + iOS-Kurzbefehle:
// - Während der Fahrt streamt SensorLogger Standort-Batches per HTTP Push an
//   POST /api/track?token=...  (der Token stammt aus automationTokens/{token}
//   und identifiziert Fahrer + Auto).
// - Der Zwischenstand (Distanzsumme, letzte Position) liegt in
//   activeTrips/{token}; es werden nie Roh-Routen gespeichert.
// - Beim Trennen ruft der Kurzbefehl GET /api/track?token=...&action=finish
//   auf: Die Fahrt wird als Log-Eintrag (source: "auto") eingetragen und der
//   Fahrer per Push zum Überprüfen aufgefordert.
// Schreibzugriff läuft über das Admin SDK (FIREBASE_SERVICE_ACCOUNT), da die
// Automation ohne eingeloggten Firebase-Nutzer arbeitet.

export const runtime = "nodejs";

// Fahrten unter 500 m gelten als Rangieren und werden nicht eingetragen
const MIN_TRIP_METERS = 500;
// Punkte mit schlechterer GPS-Genauigkeit werden ignoriert
const MAX_ACCURACY_METERS = 50;
// Implizite Geschwindigkeit über 70 m/s (252 km/h) = GPS-Sprung, ignorieren
const MAX_SPEED_MS = 70;
// Nach 30 Minuten ohne Daten gilt eine offene Fahrt als beendet
const STALE_TRIP_MS = 30 * 60 * 1000;
// Auch komplette Aufnahmen in einem einzigen POST sind erlaubt (statt Streaming)
const MAX_POINTS_PER_REQUEST = 20000;
// Routenpunkte für die Karte: Mindestabstand zwischen gespeicherten Punkten;
// bei sehr langen Fahrten wird adaptiv ausgedünnt (Firestore-Dokumentlimit)
const ROUTE_MIN_SPACING_METERS = 20;
const ROUTE_MAX_POINTS = 4000;

let adminDb: Firestore | null = null;

function getAdminDb(): Firestore | null {
  if (adminDb) return adminDb;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const json = raw.trim().startsWith("{")
      ? raw
      : Buffer.from(raw, "base64").toString("utf8");
    const credentials = JSON.parse(json);
    const app = getApps().length
      ? getApps()[0]
      : initializeApp({ credential: cert(credentials) });
    adminDb = getFirestore(app);
    return adminDb;
  } catch (e) {
    console.error("FIREBASE_SERVICE_ACCOUNT konnte nicht gelesen werden:", e);
    return null;
  }
}

const formatKm = (km: number) =>
  km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");

function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

interface TrackPoint {
  t: number; // ms seit Epoch
  lat: number;
  lng: number;
  acc: number;
}

// SensorLogger sendet {"messageId","sessionId","deviceId","payload":[{"name":
// "location","time":<ns>,"values":{"latitude":..,"longitude":..,...}},...]};
// andere Sensoren (accelerometer etc.) werden ignoriert.
function extractLocations(body: unknown): TrackPoint[] {
  const payload = (body as { payload?: unknown })?.payload;
  if (!Array.isArray(payload)) return [];
  const points: TrackPoint[] = [];
  for (const entry of payload.slice(0, MAX_POINTS_PER_REQUEST)) {
    if (entry?.name !== "location") continue;
    const v = entry.values ?? {};
    const lat = Number(v.latitude);
    const lng = Number(v.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    let t = Number(entry.time) || 0;
    // Zeitstempel normalisieren (SensorLogger: Nanosekunden)
    if (t > 1e17) t = t / 1e6;
    else if (t > 1e14) t = t / 1e3;
    else if (t > 0 && t < 1e11) t = t * 1000;
    points.push({ t, lat, lng, acc: Number(v.horizontalAccuracy ?? 0) });
  }
  points.sort((a, b) => a.t - b.t);
  return points;
}

interface TripState {
  uid: string;
  carId: string;
  startedAt: number;
  totalMeters: number;
  lastLat: number | null;
  lastLng: number | null;
  lastT: number;
  points: number;
  // Vereinfachte Route für die Kartenansicht: flaches Array [lat,lng,lat,lng,...]
  route: number[];
  minSpacing: number;
}

const round5 = (v: number) => Math.round(v * 1e5) / 1e5;

// Punkt in die Kartenroute übernehmen, wenn er weit genug vom zuletzt
// gespeicherten entfernt ist; bei Überlänge Route ausdünnen
function pushRoutePoint(state: TripState, lat: number, lng: number): void {
  const route = state.route;
  const n = route.length;
  if (n >= 2) {
    const d = haversineMeters(route[n - 2], route[n - 1], lat, lng);
    if (d < (state.minSpacing || ROUTE_MIN_SPACING_METERS)) return;
  }
  route.push(round5(lat), round5(lng));
  if (route.length / 2 > ROUTE_MAX_POINTS) {
    const thinned: number[] = [];
    for (let i = 0; i < route.length; i += 4) {
      thinned.push(route[i], route[i + 1]);
    }
    // Letzten Punkt immer behalten
    if (thinned[thinned.length - 2] !== route[route.length - 2] ||
        thinned[thinned.length - 1] !== route[route.length - 1]) {
      thinned.push(route[route.length - 2], route[route.length - 1]);
    }
    state.route = thinned;
    state.minSpacing = (state.minSpacing || ROUTE_MIN_SPACING_METERS) * 2;
  }
}

function accumulate(state: TripState, points: TrackPoint[]): void {
  if (!Array.isArray(state.route)) state.route = [];
  if (!state.minSpacing) state.minSpacing = ROUTE_MIN_SPACING_METERS;
  for (const p of points) {
    if (p.t <= state.lastT) continue; // Duplikat / außer Reihenfolge
    if (p.acc > MAX_ACCURACY_METERS) continue;
    if (state.lastLat === null || state.lastLng === null) {
      state.lastLat = p.lat;
      state.lastLng = p.lng;
      state.lastT = p.t;
      state.points++;
      pushRoutePoint(state, p.lat, p.lng);
      continue;
    }
    const d = haversineMeters(state.lastLat, state.lastLng, p.lat, p.lng);
    const dt = (p.t - state.lastT) / 1000;
    if (dt <= 0) continue;
    if (d / dt > MAX_SPEED_MS) continue; // GPS-Sprung
    if (d >= 2) {
      state.totalMeters += d;
      state.lastLat = p.lat;
      state.lastLng = p.lng;
      state.lastT = p.t;
      pushRoutePoint(state, p.lat, p.lng);
    } else {
      // Stillstand: Zeit fortschreiben, Position halten (GPS-Zittern im Stand
      // soll keine Kilometer erzeugen)
      state.lastT = p.t;
    }
    state.points++;
  }
}

interface StoredSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

async function sendTripPushes(
  db: Firestore,
  carId: string,
  carName: string,
  driverUid: string,
  driverName: string,
  members: string[],
  startKm: number,
  endKm: number,
  distKm: number
): Promise<void> {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    publicKey,
    privateKey
  );

  const subsSnap = await db.collection(`cars/${carId}/pushSubscriptions`).get();
  const sends: Promise<unknown>[] = [];
  subsSnap.forEach((docSnap) => {
    const uid = docSnap.id;
    if (!members.includes(uid)) return;
    const subs = docSnap.get("subs");
    if (!Array.isArray(subs)) return;
    const isDriver = uid === driverUid;
    const payload = JSON.stringify({
      title: carName,
      body: isDriver
        ? `Fahrt automatisch eingetragen: ${distKm} km (${formatKm(startKm)} → ${formatKm(endKm)}). Bitte überprüfen und bei Bedarf korrigieren.`
        : `${driverName} hat eine Fahrt eingetragen: ${formatKm(startKm)} → ${formatKm(endKm)} km`,
      url: `/${carId}/log`,
    });
    subs.forEach((s: StoredSub) => {
      if (s?.endpoint && s?.keys?.p256dh && s?.keys?.auth) {
        sends.push(
          webpush
            .sendNotification(s, payload, { TTL: 24 * 60 * 60, urgency: "high" })
            .catch(() => {})
        );
      }
    });
  });
  await Promise.allSettled(sends);
}

async function finalizeTrip(
  db: Firestore,
  token: string,
  state: TripState
): Promise<{ created: boolean; km?: number; reason?: string }> {
  await db.doc(`activeTrips/${token}`).delete().catch(() => {});

  if (state.totalMeters < MIN_TRIP_METERS) {
    return {
      created: false,
      reason: `Nur ${Math.round(state.totalMeters)} m Bewegung - nicht eingetragen.`,
    };
  }
  const distKm = Math.max(1, Math.round(state.totalMeters / 1000));

  const logsRef = db.collection(`cars/${state.carId}/logs`);
  const [carSnap, profileSnap, maxSnap] = await Promise.all([
    db.doc(`cars/${state.carId}`).get(),
    db.doc(`users/${state.uid}`).get(),
    logsRef.orderBy("km", "desc").limit(1).get(),
  ]);
  if (!carSnap.exists) return { created: false, reason: "Auto existiert nicht mehr." };
  const members: string[] = carSnap.get("members") || [];
  if (!members.includes(state.uid)) {
    return { created: false, reason: "Kein Mitglied mehr." };
  }

  const initialKm: number = carSnap.get("initialKm") || 0;
  const lastKm = maxSnap.empty ? 0 : Number(maxSnap.docs[0].get("km")) || 0;
  const startKm = Math.max(lastKm, initialKm);
  const endKm = startKm + distKm;
  const driverName: string = profileSnap.get("displayName") || "Unbekannt";

  const logRef = await logsRef.add({
    userName: driverName,
    userColor: profileSnap.get("color") || "#ccc",
    startKm,
    km: endKm,
    description: "Automatisch erfasste Fahrt (GPS)",
    timestamp: FieldValue.serverTimestamp(),
    userId: state.uid,
    type: "drive",
    source: "auto",
  });

  // Route für die Kartenansicht speichern (Dokument-ID = Log-ID, damit sie
  // beim Löschen des Eintrags mit aufgeräumt werden kann)
  try {
    const route = Array.isArray(state.route) ? [...state.route] : [];
    // Endposition sicherstellen (kann wegen Mindestabstand fehlen)
    if (
      state.lastLat !== null &&
      state.lastLng !== null &&
      (route.length < 2 ||
        route[route.length - 2] !== round5(state.lastLat) ||
        route[route.length - 1] !== round5(state.lastLng))
    ) {
      route.push(round5(state.lastLat), round5(state.lastLng));
    }
    if (route.length >= 4) {
      const pairs: [number, number][] = [];
      for (let i = 0; i < route.length; i += 2) {
        pairs.push([route[i], route[i + 1]]);
      }
      await db.doc(`cars/${state.carId}/routes/${logRef.id}`).set({
        userId: state.uid,
        points: encodePolyline(pairs),
        distanceMeters: Math.round(state.totalMeters),
        startLat: pairs[0][0],
        startLng: pairs[0][1],
        endLat: pairs[pairs.length - 1][0],
        endLng: pairs[pairs.length - 1][1],
        startedAt: state.startedAt || null,
        timestamp: FieldValue.serverTimestamp(),
      });
    }
  } catch (e) {
    console.warn("Route konnte nicht gespeichert werden:", e);
  }

  await sendTripPushes(
    db,
    state.carId,
    carSnap.get("name") || "CarShare",
    state.uid,
    driverName,
    members,
    startKm,
    endKm,
    distKm
  ).catch((e) => console.warn("Push nach Auto-Fahrt fehlgeschlagen:", e));

  return { created: true, km: distKm };
}

async function resolveToken(
  db: Firestore,
  token: string | null
): Promise<{ uid: string; carId: string } | null> {
  if (!token || !/^[A-Za-z0-9_-]{10,80}$/.test(token)) return null;
  const snap = await db.doc(`automationTokens/${token}`).get();
  if (!snap.exists) return null;
  const uid = snap.get("uid");
  const carId = snap.get("carId");
  if (typeof uid !== "string" || typeof carId !== "string") return null;
  return { uid, carId };
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const db = getAdminDb();
  if (!db) {
    return NextResponse.json(
      { error: "Server nicht konfiguriert (FIREBASE_SERVICE_ACCOUNT fehlt)." },
      { status: 500 }
    );
  }

  const token = request.nextUrl.searchParams.get("token");
  const auth = await resolveToken(db, token);
  if (!auth || !token) {
    return NextResponse.json({ error: "Ungültiger Token." }, { status: 401 });
  }

  let body: unknown = null;
  if (request.method === "POST") {
    try {
      body = await request.json();
    } catch {
      body = null;
    }
  }

  const action =
    request.nextUrl.searchParams.get("action") ||
    (body as { action?: string })?.action ||
    "";

  const tripRef = db.doc(`activeTrips/${token}`);
  const tripSnap = await tripRef.get();
  let state: TripState | null = tripSnap.exists
    ? (tripSnap.data() as TripState)
    : null;

  if (action === "finish") {
    if (!state) {
      return NextResponse.json({ ok: true, created: false, reason: "Keine aktive Fahrt." });
    }
    const result = await finalizeTrip(db, token, state);
    return NextResponse.json({ ok: true, ...result });
  }

  // Standort-Batch verarbeiten
  const points = extractLocations(body);

  // Liegen gebliebene Fahrt (z. B. Finish-Aufruf ging verloren) erst abschließen
  if (state && Date.now() - state.lastT > STALE_TRIP_MS && state.lastT > 0) {
    await finalizeTrip(db, token, state);
    state = null;
  }

  if (points.length === 0) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!state) {
    state = {
      uid: auth.uid,
      carId: auth.carId,
      startedAt: points[0].t || Date.now(),
      totalMeters: 0,
      lastLat: null,
      lastLng: null,
      lastT: 0,
      points: 0,
      route: [],
      minSpacing: ROUTE_MIN_SPACING_METERS,
    };
  }

  accumulate(state, points);
  await tripRef.set(state);

  return NextResponse.json({ ok: true, totalMeters: Math.round(state.totalMeters) });
}

export async function POST(request: NextRequest) {
  return handle(request);
}

// GET wird vom Kurzbefehl ("Inhalt von URL abrufen") für action=finish genutzt
export async function GET(request: NextRequest) {
  return handle(request);
}
