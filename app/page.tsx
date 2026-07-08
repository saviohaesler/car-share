// app/page.tsx
"use client";

import { signInWithPopup, User } from "firebase/auth";
import { auth, googleProvider, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, setDoc, getDocs, deleteDoc, updateDoc, arrayRemove, Timestamp } from "firebase/firestore";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useUserProfiles } from "../lib/useUserProfiles";
import { useTheme } from "../lib/useTheme";
import { useViewportReset } from "../lib/useViewportReset";
import { ensureUserProfile } from "../lib/userProfile";
import { PRESET_COLORS } from "../lib/constants";
import Landing from "./Landing";
import {
  disablePush,
  enablePush,
  getCurrentSubscription,
  isIosWithoutPwa,
  isPushEnabledLocally,
  isPushSupported,
} from "../lib/push";

interface Car {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  initialKm?: number;
}

const INVITE_VALIDITY_DAYS = 7;

// Kurze Erste-Schritte-Hilfe für das Info-Modal (i-Button im Header)
const HELP_ITEMS = [
  {
    title: "Fahrten",
    text: "Nach jeder Fahrt den neuen KM-Stand eintragen – mehr braucht es nicht.",
    iconBg: "bg-green-50 dark:bg-green-950/30",
    iconColor: "text-green-600 dark:text-green-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
      </svg>
    ),
  },
  {
    title: "Kalender",
    text: "Das Auto reservieren, damit alle sehen, wann es besetzt ist.",
    iconBg: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
  },
  {
    title: "Tanken",
    text: "Beim Tanken den Betrag erfassen – die Kosten werden automatisch nach gefahrenen Kilometern aufgeteilt.",
    iconBg: "bg-orange-50 dark:bg-orange-950/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 22h12"/><path d="M5 22V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v18"/><path d="M13 14h6a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-6"/><path d="M19 14v5a3 3 0 0 1-3 3"/><path d="M5 10h8"/>
      </svg>
    ),
  },
  {
    title: "Statistik",
    text: "Kilometer, Tankstopps und Kosten pro Person im Überblick.",
    iconBg: "bg-violet-50 dark:bg-violet-950/30",
    iconColor: "text-violet-600 dark:text-violet-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
  },
  {
    title: "Auto-Tracking",
    text: "Fahrten automatisch im Hintergrund aufzeichnen. In den Einstellungen aktivierbar.",
    actionId: "openProfile",
    iconBg: "bg-indigo-50 dark:bg-indigo-950/30",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
        <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
        <line x1="12" y1="20" x2="12.01" y2="20"></line>
      </svg>
    ),
  },
  {
    title: "Karte",
    text: "Aufgezeichnete Strecken pro Person und der letzte bekannte Standort des Autos.",
    iconBg: "bg-teal-50 dark:bg-teal-950/30",
    iconColor: "text-teal-600 dark:text-teal-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
        <circle cx="12" cy="10" r="3"></circle>
      </svg>
    ),
  },
  {
    title: "Einladen",
    text: "Über das Teilen-Symbol beim Auto einen Einladungslink kopieren (7 Tage gültig) und weitergeben.",
    iconBg: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
        <polyline points="16 6 12 2 8 6"></polyline>
        <line x1="12" y1="2" x2="12" y2="15"></line>
      </svg>
    ),
  },
  {
    title: "Als App nutzen",
    text: "In Safari über „Teilen“ → „Zum Home-Bildschirm“ installieren und im Profil die Push-Mitteilungen aktivieren.",
    iconBg: "bg-red-50 dark:bg-red-950/30",
    iconColor: "text-red-500 dark:text-red-400",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    ),
  },
];

const inviteExpiry = () =>
  Timestamp.fromMillis(Date.now() + INVITE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  // Verhindert, dass eingeloggte Nutzer beim Laden kurz die Landingpage sehen,
  // solange Firebase den Auth-Status noch wiederherstellt
  const [authReady, setAuthReady] = useState(false);
  const [carName, setCarName] = useState("");
  const [newCarInitialKm, setNewCarInitialKm] = useState("");
  const [cars, setCars] = useState<Car[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [userColor, setUserColor] = useState(PRESET_COLORS[0]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [isEditCarModalOpen, setIsEditCarModalOpen] = useState(false);
  const [editCarData, setEditCarData] = useState<{id: string, name: string, initialKm: string} | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [isTogglingPush, setIsTogglingPush] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isAutoTrackingInfoOpen, setIsAutoTrackingInfoOpen] = useState(false);
  // Auto-Tracking: carId -> Token-ID (Dokument-ID in automationTokens)
  const [autoTokens, setAutoTokens] = useState<Record<string, string>>({});
  const [autoTokenBusy, setAutoTokenBusy] = useState<string | null>(null);
  const { theme, toggleTheme } = useTheme();
  useViewportReset();

  // Aktuellen Push-Status ermitteln, sobald das Profil-Modal geöffnet wird
  useEffect(() => {
    if (!isProfileModalOpen) return;
    let cancelled = false;
    (async () => {
      if (!isPushSupported()) {
        if (!cancelled) setPushEnabled(false);
        return;
      }
      const sub = await getCurrentSubscription();
      if (!cancelled) setPushEnabled(!!sub && isPushEnabledLocally());
    })();
    return () => { cancelled = true; };
  }, [isProfileModalOpen]);

  // Eigene Automations-Tokens laden, sobald das Profil-Modal geöffnet wird
  useEffect(() => {
    if (!isProfileModalOpen || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, "automationTokens"), where("uid", "==", user.uid)));
        if (cancelled) return;
        const map: Record<string, string> = {};
        snap.forEach((d) => {
          const carId = d.data().carId;
          if (typeof carId === "string") map[carId] = d.id;
        });
        setAutoTokens(map);
      } catch (error) {
        console.warn("Automations-Tokens konnten nicht geladen werden:", error);
      }
    })();
    return () => { cancelled = true; };
  }, [isProfileModalOpen, user]);

  const automationUrl = (tokenId: string) =>
    `${window.location.origin}/api/track?token=${tokenId}`;

  const copyToClipboard = async (text: string) => {
    let copied = false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (err) { console.error("Clipboard API failed", err); }
    }
    if (!copied) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        copied = document.execCommand('copy');
        textArea.remove();
      } catch (e) { console.error("execCommand failed", e); }
    }
    return copied;
  };

  const copyAutomationLink = async (tokenId: string) => {
    const url = automationUrl(tokenId);
    const copied = await copyToClipboard(url);
    if (copied) {
      alert("Tracking-Link kopiert! Kann nun in SensorLogger und in die Kurzbefehle eingefügt werden.");
    } else {
      window.prompt("Tracking-Link kopieren:", url);
    }
  };

  const createAutomationToken = async (carId: string) => {
    if (!user || autoTokenBusy) return;
    setAutoTokenBusy(carId);
    
    // Generiere ID synchron VOR dem Await, damit das Kopieren auf iOS nicht blockiert wird
    const tokenRef = doc(collection(db, "automationTokens"));
    const url = automationUrl(tokenRef.id);
    
    const copied = await copyToClipboard(url);
    if (copied) {
      alert("Tracking-Link kopiert! Kann nun in SensorLogger und in die Kurzbefehle eingefügt werden.");
    } else {
      window.prompt("Tracking-Link kopieren:", url);
    }

    try {
      await setDoc(tokenRef, { uid: user.uid, carId, createdAt: serverTimestamp() });
      setAutoTokens((prev) => ({ ...prev, [carId]: tokenRef.id }));
    } catch (error) {
      console.error(error);
      alert("Tracking-Link konnte nicht in der Datenbank gespeichert werden.");
    }
    setAutoTokenBusy(null);
  };

  const deleteAutomationToken = async (carId: string) => {
    const tokenId = autoTokens[carId];
    if (!tokenId || autoTokenBusy) return;
    if (!window.confirm("Tracking-Link wirklich löschen? Die Automation funktioniert danach nicht mehr.")) return;
    setAutoTokenBusy(carId);
    try {
      await deleteDoc(doc(db, "automationTokens", tokenId));
      setAutoTokens((prev) => {
        const next = { ...prev };
        delete next[carId];
        return next;
      });
    } catch (error) {
      console.error(error);
      alert("Tracking-Link konnte nicht gelöscht werden. Bitte erneut versuchen.");
    }
    setAutoTokenBusy(null);
  };

  const toggleNotifications = async () => {
    if (!user || isTogglingPush) return;
    if (!isPushSupported()) {
      alert(
        isIosWithoutPwa()
          ? "Auf dem iPhone zuerst installieren: In Safari über „Teilen“ → „Zum Home-Bildschirm“, dann die App vom Home-Bildschirm öffnen."
          : "Dieser Browser unterstützt keine Push-Benachrichtigungen."
      );
      return;
    }
    setIsTogglingPush(true);
    try {
      const carIds = cars.map((c) => c.id);
      if (pushEnabled) {
        await disablePush(carIds, user.uid);
        setPushEnabled(false);
      } else {
        await enablePush(carIds, user.uid);
        setPushEnabled(true);
      }
    } catch (error) {
      console.error(error);
      alert(error instanceof Error ? error.message : "Benachrichtigungen konnten nicht geändert werden.");
    }
    setIsTogglingPush(false);
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setCars([]);
        return;
      }
      try {
        const profile = await ensureUserProfile(currentUser);
        setDisplayName(profile.displayName);
        setUserColor(profile.color);
      } catch (error) {
        console.error(error);
      }
    });
    return () => unsubscribe();
  }, []);

  const userProfiles = useUserProfiles([user?.uid, ...cars.flatMap((c) => c.members)]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "cars"), where("members", "array-contains", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCars(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Car)));
    });
    return () => unsubscribe();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      alert("Bitte einen Anzeigenamen eingeben!");
      return;
    }
    setIsSavingProfile(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        displayName: trimmedName,
        color: userColor,
        uid: user.uid
      }, { merge: true });
      setDisplayName(trimmedName);
      setIsProfileModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Profil konnte nicht gespeichert werden.");
    }
    setIsSavingProfile(false);
  };

  const handleCreateCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carName.trim() || !user) return;
    try {
      await addDoc(collection(db, "cars"), {
        name: carName.trim(),
        initialKm: Math.max(0, Number(newCarInitialKm) || 0),
        ownerId: user.uid,
        members: [user.uid],
        createdAt: serverTimestamp(),
      });
      setCarName("");
      setNewCarInitialKm("");
    } catch (error) {
      console.error(error);
      alert("Auto konnte nicht erstellt werden. Bitte erneut versuchen.");
    }
  };

  const openEditCarModal = (car: Car) => {
    setEditCarData({
      id: car.id,
      name: car.name,
      initialKm: car.initialKm?.toString() || "0"
    });
    setIsEditCarModalOpen(true);
  };

  const saveCarSettings = async () => {
    if (!editCarData || !editCarData.name.trim()) return;
    try {
      await updateDoc(doc(db, "cars", editCarData.id), {
        name: editCarData.name.trim(),
        initialKm: Math.max(0, Number(editCarData.initialKm) || 0)
      });
      setIsEditCarModalOpen(false);
    } catch (error) {
      console.error(error);
      alert("Einstellungen konnten nicht gespeichert werden. Bitte erneut versuchen.");
    }
  };

  const handleDeleteCar = async () => {
    if (!editCarData) return;
    if (window.confirm(`Auto "${editCarData.name}" wirklich unwiderruflich löschen?`)) {
      try {
        // Firestore doesn't automatically delete subcollections - remove logs and
        // reservations first, otherwise orphaned data remains.
        for (const sub of ["logs", "reservations", "pushSubscriptions", "routes"]) {
          const snap = await getDocs(collection(db, "cars", editCarData.id, sub));
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 100) {
            await Promise.all(docs.slice(i, i + 100).map((d) => deleteDoc(d.ref)));
          }
        }
        await deleteDoc(doc(db, "cars", editCarData.id));
        setIsEditCarModalOpen(false);
      } catch (error) {
        console.error(error);
        alert("Auto konnte nicht vollständig gelöscht werden. Bitte erneut versuchen.");
      }
    }
  };

  const handleCopyInvite = async (e: React.MouseEvent, car: Car) => {
    e.preventDefault(); e.stopPropagation();
    if (!user) return;

    // Generiere Token-ID synchron VOR dem Await, damit iOS Safari das Clipboard nicht blockiert
    const inviteRef = doc(collection(db, "invites"));
    const inviteLink = `${window.location.origin}/invite/${inviteRef.id}`;

    const copied = await copyToClipboard(inviteLink);
    if (copied) {
      alert("Einladungslink kopiert! Der Link ist 7 Tage gültig.");
    } else {
      window.prompt("Link kopieren (7 Tage gültig):", inviteLink);
    }

    try {
      await setDoc(inviteRef, {
        carId: car.id,
        carName: car.name,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        expiresAt: inviteExpiry(),
      });
    } catch (err) {
      console.error(err);
      alert("Einladung konnte nicht erstellt werden.");
    }
  };

  const removeMember = async (carId: string, memberId: string) => {
    if (window.confirm("Mitglied wirklich entfernen?")) {
      try {
        await updateDoc(doc(db, "cars", carId), { members: arrayRemove(memberId) });
        // Push-Abo des entfernten Mitglieds mit aufräumen (best effort)
        deleteDoc(doc(db, "cars", carId, "pushSubscriptions", memberId)).catch(() => {});
        if (memberId === user?.uid) setIsMemberModalOpen(false);
      } catch (error) {
        console.error(error);
        alert("Mitglied konnte nicht entfernt werden. Bitte erneut versuchen.");
      }
    }
  };

  // selectedCar is a snapshot - always show the live state from "cars" in the modal
  const memberModalCar = selectedCar ? (cars.find((c) => c.id === selectedCar.id) ?? selectedCar) : null;

  // Solange der Auth-Status lädt: nur der Hintergrund (kein Flackern)
  if (!authReady) {
    return <main className="w-full h-full bg-gray-50 dark:bg-zinc-950" />;
  }

  // Nicht angemeldete Besucher sehen die Landingpage
  if (!user) {
    return <Landing />;
  }

  return (
    <main className="w-full h-full flex flex-col items-center justify-center p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))] bg-gray-50 dark:bg-zinc-950 overflow-hidden relative text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <div className="bg-white dark:bg-zinc-900 p-6 md:p-8 rounded-[2.5rem] shadow-xl dark:shadow-zinc-950/40 max-w-md lg:max-w-2xl w-full flex flex-col max-h-full text-center border border-gray-100 dark:border-zinc-800/80">
        
        <div className="flex justify-between items-center mb-6 px-2 shrink-0">
          <button onClick={() => setIsHelpModalOpen(true)} aria-label="Hilfe" className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-xl active:scale-90 transition text-gray-500 dark:text-gray-400">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          </button>
          <h1 className="text-3xl font-black tracking-tight italic uppercase">
            {"CARSHARE".split("").map((char, index) => (
              <span key={index} style={{ color: PRESET_COLORS[index % PRESET_COLORS.length] }}>
                {char}
              </span>
            ))}
          </h1>
          {user ? (
            <button onClick={() => setIsProfileModalOpen(true)} className="p-2 bg-gray-50 dark:bg-zinc-800 rounded-xl active:scale-90 transition text-gray-500 dark:text-gray-400">
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          ) : <div className="w-10"></div>}
        </div>
        
        {user ? (
          <div className="flex flex-col gap-6 flex-1 overflow-hidden">
            <div className="text-center shrink-0">
              <p className="text-2xl font-black italic text-gray-800 dark:text-zinc-100">
                Hallo <span style={{ color: userColor }}>{displayName}</span>
              </p>
            </div>

            <div className="text-left flex flex-col flex-1 overflow-hidden min-h-0">
              <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-3 tracking-widest ml-1 shrink-0">Meine Autos</h2>
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1 custom-scrollbar lg:grid lg:grid-cols-2 lg:content-start">
                {cars.map((car) => (
                  <div key={car.id} className="relative shrink-0">
                    <Link href={`/${car.id}/log`} className="bg-white dark:bg-zinc-900 border-2 border-gray-100 dark:border-zinc-800/80 p-5 rounded-3xl flex justify-between items-center transition shadow-sm active:scale-[0.98]">
                      <div className="flex flex-col text-left">
                        <span className="font-bold text-gray-800 dark:text-zinc-100 text-lg">{car.name}</span>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedCar(car); setIsMemberModalOpen(true); }} className="text-xs font-bold text-blue-500 dark:text-blue-400 mt-1 text-left uppercase tracking-tighter active:opacity-75 transition">
                          {car.members.length} Personen
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => handleCopyInvite(e, car)} className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded-xl active:scale-90 transition">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                        </button>
                        {car.ownerId === user.uid && (
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditCarModal(car); }} className="p-2 bg-gray-100 dark:bg-zinc-800 rounded-xl active:scale-90 transition">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-600 dark:text-zinc-300" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                          </button>
                        )}
                        <span className="text-gray-300 dark:text-zinc-600 font-black ml-1">→</span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateCar} className="flex flex-col gap-2 bg-gray-50 dark:bg-zinc-900/50 p-4 rounded-3xl border border-dashed border-gray-300 dark:border-zinc-700 shrink-0 lg:flex-row lg:items-center">
               <input type="text" placeholder="Auto Name..." value={carName} onChange={(e) => setCarName(e.target.value)} maxLength={100} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl w-full font-bold text-gray-900 dark:text-white shadow-sm outline-none border border-gray-100 dark:border-zinc-800 focus:border-blue-500 transition lg:flex-1" required />
               <input type="number" placeholder="Start KM-Stand..." value={newCarInitialKm} onChange={(e) => setNewCarInitialKm(e.target.value)} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl w-full font-bold text-gray-900 dark:text-white shadow-sm outline-none border border-gray-100 dark:border-zinc-800 focus:border-blue-500 transition lg:flex-1" />
               <button type="submit" className="bg-gray-800 dark:bg-zinc-750 text-white p-4 rounded-2xl font-bold active:scale-95 transition mt-1 lg:mt-0 lg:w-auto lg:px-8 lg:shrink-0">Hinzufügen</button>
            </form>

            <button onClick={() => auth.signOut()} className="bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 font-bold py-4 rounded-2xl active:scale-95 transition uppercase text-xs tracking-widest shrink-0 mt-2">Abmelden</button>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center">
            <p className="text-gray-400 dark:text-zinc-500 font-bold mb-8 italic uppercase tracking-tighter">Bereit für die Fahrt?</p>
            <button onClick={() => signInWithPopup(auth, googleProvider)} className="flex items-center justify-center gap-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 font-bold py-4 px-8 rounded-full w-full shadow-sm hover:shadow-md active:scale-95 transition text-lg">
              <svg width="24" height="24" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Weiter mit Google
            </button>
          </div>
        )}
      </div>

      {/* HILFE MODAL */}
      {isHelpModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-800">
            <h2 className="text-xl font-black mb-2 uppercase italic text-center text-black dark:text-white">Hilfe</h2>
            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-center mb-5">So funktioniert CarShare</p>
            <div className="flex flex-col gap-3 max-h-[55vh] overflow-y-auto custom-scrollbar pr-1">
              {HELP_ITEMS.map((item) => (
                <div key={item.title} className="flex items-start gap-3 bg-gray-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                  <div className={`p-2 rounded-xl shrink-0 ${item.iconBg} ${item.iconColor}`}>
                    {item.icon}
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-black text-gray-800 dark:text-zinc-100 text-xs uppercase italic tracking-tight">{item.title}</span>
                    <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{item.text}</span>
                    {(item as any).actionId === "openProfile" && (
                       <button onClick={() => { setIsHelpModalOpen(false); setIsProfileModalOpen(true); }} className="mt-2 text-[10px] bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 px-3 py-1.5 rounded-lg font-black uppercase w-fit active:scale-95 transition">Zu den Einstellungen</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={() => setIsHelpModalOpen(false)} className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 font-bold py-4 rounded-2xl uppercase text-xs active:scale-95 transition mt-5">Schließen</button>
          </div>
        </div>
      )}

      {/* PROFIL MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-800">
            <h2 className="text-xl font-black mb-6 uppercase italic text-center text-black dark:text-white">Profil</h2>
            <div className="flex flex-col gap-6 max-h-[70vh] overflow-y-auto custom-scrollbar pr-1">
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">Anzeigename</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border-2 border-gray-200 dark:border-zinc-800/80 font-black text-gray-900 dark:text-white mt-2 outline-none focus:border-blue-500 transition-colors shadow-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">Kalender Farbe</label>
                <div className="flex flex-wrap gap-2 mt-2 p-1 max-h-[120px] overflow-y-auto custom-scrollbar">
                  {PRESET_COLORS.map(color => (
                    <button key={color} onClick={() => setUserColor(color)} className={`w-8 h-8 rounded-full transition-all ${userColor === color ? 'scale-110 ring-4 ring-offset-2 ring-gray-200 dark:ring-zinc-700' : 'opacity-50'}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">Darstellung</label>
                <div className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/80 mt-2">
                  <span className="text-sm font-bold text-gray-750 dark:text-zinc-300">
                    {theme === "light" ? "Helles Design" : "Dunkles Design"}
                  </span>
                  <button
                    type="button"
                    onClick={toggleTheme}
                    className="p-2.5 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl active:scale-90 transition text-gray-500 dark:text-gray-400 shadow-sm"
                  >
                    {theme === "light" ? (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
                    ) : (
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.22" x2="5.64" y2="17.78"></line><line x1="18.36" y1="5.64" x2="19.78" y2="7.06"></line></svg>
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">Benachrichtigungen</label>
                <div className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/80 mt-2">
                  <span className="text-sm font-bold text-gray-750 dark:text-zinc-300">
                    Push-Mitteilungen
                  </span>
                  <button
                    type="button"
                    onClick={toggleNotifications}
                    disabled={isTogglingPush}
                    aria-label="Push-Benachrichtigungen umschalten"
                    className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${pushEnabled ? "bg-blue-600" : "bg-gray-200 dark:bg-zinc-700"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${pushEnabled ? "translate-x-5" : ""}`} />
                  </button>
                </div>
                {isIosWithoutPwa() && (
                  <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 mt-2 ml-1 uppercase leading-relaxed">
                    Auf dem iPhone: In Safari über „Teilen“ → „Zum Home-Bildschirm“ installieren und die App von dort öffnen.
                  </p>
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <label className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1">Auto-Tracking</label>
                  <button onClick={() => setIsAutoTrackingInfoOpen(true)} className="p-1 text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full transition bg-blue-50/50 dark:bg-blue-900/20" title="Einrichtungs-Anleitung öffnen">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
                  </button>
                </div>
                <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 ml-1 leading-relaxed">
                  Persönlicher Link pro Auto für die automatische Fahrterfassung.
                </p>
                <div className="flex flex-col gap-2 mt-2">
                  {cars.length === 0 && (
                    <p className="text-[10px] font-bold text-gray-300 dark:text-zinc-600 uppercase ml-1">Noch keine Autos</p>
                  )}
                  {cars.map((car) => (
                    <div key={car.id} className="flex justify-between items-center gap-2 bg-gray-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                      <span className="text-sm font-bold text-gray-750 dark:text-zinc-300 truncate">{car.name}</span>
                      {autoTokens[car.id] ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => copyAutomationLink(autoTokens[car.id])}
                            className="text-[10px] bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg font-black uppercase border border-blue-200 dark:border-blue-900/40 active:scale-95 transition"
                          >
                            Link kopieren
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteAutomationToken(car.id)}
                            disabled={autoTokenBusy === car.id}
                            className="text-[10px] bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 px-3 py-1.5 rounded-lg font-black uppercase border border-red-100 dark:border-red-900/30 active:scale-95 transition disabled:opacity-50"
                          >
                            Löschen
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => createAutomationToken(car.id)}
                          disabled={autoTokenBusy === car.id}
                          className="text-[10px] bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 px-3 py-1.5 rounded-lg font-black uppercase active:scale-95 transition shrink-0 disabled:opacity-50"
                        >
                          {autoTokenBusy === car.id ? "Erstellt..." : "Link erstellen"}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={saveProfile} disabled={isSavingProfile} className="bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition uppercase italic disabled:opacity-50">{isSavingProfile ? "Speichert..." : "Speichern"}</button>
                <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-400 dark:text-zinc-500 font-bold text-sm uppercase text-center mt-2">Schließen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTO BEARBEITEN MODAL */}
      {isEditCarModalOpen && editCarData && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-800">
            <h2 className="text-xl font-black mb-6 text-center italic uppercase tracking-tighter text-black dark:text-white">Auto Einstellungen</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1 tracking-widest">Name</label>
                <input type="text" value={editCarData.name} onChange={(e) => setEditCarData({...editCarData, name: e.target.value})} maxLength={100} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border-2 border-gray-200 dark:border-zinc-800/80 font-black text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase ml-1 tracking-widest">Start KM-Stand</label>
                <input type="number" value={editCarData.initialKm} onChange={(e) => setEditCarData({...editCarData, initialKm: e.target.value})} className="w-full p-4 rounded-xl bg-gray-50 dark:bg-zinc-950/60 border-2 border-gray-200 dark:border-zinc-800/80 font-black text-gray-900 dark:text-white outline-none focus:border-blue-500 shadow-sm" />
              </div>
              <div className="flex flex-col gap-2 mt-4">
                <button onClick={saveCarSettings} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition uppercase italic">Speichern</button>
                <button onClick={() => setIsEditCarModalOpen(false)} className="text-gray-400 dark:text-zinc-500 font-bold text-sm uppercase text-center mt-2">Schließen</button>
                <button onClick={handleDeleteCar} className="w-full bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 font-bold py-3 rounded-xl uppercase text-[10px] mt-2 border border-red-100 dark:border-red-900/30">Auto löschen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONEN MODAL */}
      {isMemberModalOpen && memberModalCar && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-800">
            <h2 className="text-xl font-black mb-4 text-center italic uppercase text-black dark:text-white">Personen</h2>
            <div className="flex flex-col gap-3 mb-6">
              {memberModalCar.members.map((mId) => (
                <div key={mId} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-800/40 p-3 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: userProfiles[mId]?.color || '#ccc' }}></div>
                    <span className="font-bold text-sm text-black dark:text-zinc-100">
                      {userProfiles[mId]?.displayName || (mId === user?.uid ? user?.displayName : '') || 'Neues Mitglied'}
                    </span>
                    {mId === memberModalCar.ownerId && (
                      <span className="text-[9px] bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md font-black uppercase border border-amber-200 dark:border-amber-900/40 flex items-center gap-0.5 shrink-0 select-none">
                        Owner
                      </span>
                    )}
                  </div>
                  {memberModalCar.ownerId === user?.uid && mId !== user?.uid && <button onClick={() => removeMember(memberModalCar.id, mId)} className="text-[10px] bg-red-100 dark:bg-red-950/30 text-red-500 dark:text-red-400 px-3 py-1 rounded-lg font-black uppercase active:scale-95 transition">Entfernen</button>}
                  {mId === user?.uid && mId !== memberModalCar.ownerId && <button onClick={() => removeMember(memberModalCar.id, mId)} className="text-[10px] bg-gray-200 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 px-3 py-1 rounded-lg font-black uppercase active:scale-95 transition">Verlassen</button>}
                </div>
              ))}
            </div>
            <button onClick={() => setIsMemberModalOpen(false)} className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 font-bold py-4 rounded-2xl uppercase text-xs active:scale-95 transition">Schließen</button>
          </div>
        </div>
      )}

      {/* AUTO TRACKING INFO MODAL */}
      {isAutoTrackingInfoOpen && (
        <div className="fixed inset-0 bg-black/60 dark:bg-black/80 flex items-center justify-center z-[60] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-2xl w-full max-w-md text-gray-900 dark:text-white border border-gray-100 dark:border-zinc-800 flex flex-col max-h-[85vh] overflow-hidden">
            <h2 className="text-xl font-black mb-2 uppercase italic text-center text-black dark:text-white">Auto-Tracking Setup</h2>
            <p className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest text-center mb-5 shrink-0">Schritt für Schritt (iPhone)</p>
            
            <div className="flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-1 pb-2">
              <div className="bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                <p className="font-black text-sm uppercase italic mb-1">1. Sensor Logger</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-2">Die App zeichnet im Hintergrund die GPS-Punkte auf.</p>
                <a href="https://apps.apple.com/ch/app/sensor-logger/id1531582925" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition active:scale-95">App herunterladen</a>
              </div>

              <div className="bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                <p className="font-black text-sm uppercase italic mb-1">2. Tracking Link einrichten</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">In der <b>Sensor Logger App</b> Standort-Erlaubnis auf "Immer" stellen. Unter <b>Settings</b> &rarr; <b>Data Streaming</b> "Enable HTTP Push" aktivieren und dort deinen <b>Tracking-Link</b> in das Feld "Push URL" einfügen.</p>
              </div>

              <div className="bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                <p className="font-black text-sm uppercase italic mb-1">3. Kurzbefehle laden</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mb-3 leading-relaxed">Diese zwei Kurzbefehle steuern die App automatisch (beim Import des Stop-Befehls deinen Tracking-Link einfügen):</p>
                <div className="flex gap-2">
                  <a href="https://www.icloud.com/shortcuts/1113098737aa4ce98a247b50d8c37406" target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-2 rounded-lg text-[10px] font-bold uppercase transition active:scale-95 border border-blue-100 dark:border-blue-900/40">Start Kurzbefehl</a>
                  <a href="https://www.icloud.com/shortcuts/1ad08c83b9014e7495990fcae9e0adb7" target="_blank" rel="noopener noreferrer" className="flex-1 text-center bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-2 rounded-lg text-[10px] font-bold uppercase transition active:scale-95 border border-blue-100 dark:border-blue-900/40">Stop Kurzbefehl</a>
                </div>
                <p className="text-[10px] text-orange-500 dark:text-orange-400 mt-3 leading-relaxed"><b>Wichtig:</b> Führe beide Kurzbefehle danach einmal manuell in der Kurzbefehle-App aus und wähle "Immer erlauben", damit sie Rechte bekommen.</p>
              </div>

              <div className="bg-gray-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/80">
                <p className="font-black text-sm uppercase italic mb-2">4. Bluetooth Automation</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mb-3">In der <b>Kurzbefehle App</b> &rarr; <b>Automation</b>:</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed mb-2"><b>(+) Neue Automation:</b> Bluetooth &rarr; Auto auswählen &rarr; <b>"Verbunden wird"</b> &rarr; <b>"Sofort ausführen"</b>. Dann den <b>Start Kurzbefehl</b> auswählen.</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed"><b>(+) Neue Automation:</b> Bluetooth &rarr; Auto auswählen &rarr; <b>"Getrennt wird"</b> &rarr; <b>"Sofort ausführen"</b>. Dann den <b>Stop Kurzbefehl</b> auswählen.</p>
              </div>
            </div>

            <button onClick={() => setIsAutoTrackingInfoOpen(false)} className="w-full bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-zinc-200 font-bold py-4 rounded-2xl uppercase text-xs active:scale-95 transition mt-4 shrink-0 border border-gray-200 dark:border-zinc-700">Schließen</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #3f3f46; }
      `}</style>
    </main>
  );
}