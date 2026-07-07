"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider } from "../lib/firebase";
import { PRESET_COLORS } from "../lib/constants";

// Landingpage für nicht angemeldete Besucher (carshare.lazolab.com).
// Wird nur von app/page.tsx gerendert, solange kein Nutzer eingeloggt ist -
// die eigentliche App (Startseite, Fahrten, Kalender, Statistik) bleibt unverändert.

function GoogleButton() {
  return (
    <button
      onClick={() => signInWithPopup(auth, googleProvider)}
      className="flex items-center justify-center gap-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 font-bold py-4 px-8 rounded-full w-full shadow-sm hover:shadow-md active:scale-95 transition text-lg"
    >
      <svg width="24" height="24" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
      Weiter mit Google
    </button>
  );
}

const FEATURES = [
  {
    title: "Fahrten",
    text: "Nach jeder Fahrt den KM-Stand eintragen – wer wie weit gefahren ist, wird automatisch festgehalten.",
    iconBg: "bg-green-50 dark:bg-green-950/30",
    iconColor: "text-green-600 dark:text-green-400",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
        <polyline points="14 2 14 8 20 8"></polyline>
        <line x1="16" y1="13" x2="8" y2="13"></line>
        <line x1="16" y1="17" x2="8" y2="17"></line>
        <line x1="10" y1="9" x2="8" y2="9"></line>
      </svg>
    ),
  },
  {
    title: "Kalender",
    text: "Das Auto reservieren, damit es keine Überschneidungen gibt – alle sehen sofort, wann es frei ist.",
    iconBg: "bg-blue-50 dark:bg-blue-950/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="16" y1="2" x2="16" y2="6"></line>
        <line x1="8" y1="2" x2="8" y2="6"></line>
        <line x1="3" y1="10" x2="21" y2="10"></line>
      </svg>
    ),
  },
  {
    title: "Tanken",
    text: "Beim Tanken den Betrag erfassen – die Kosten werden automatisch fair nach gefahrenen Kilometern aufgeteilt.",
    iconBg: "bg-orange-50 dark:bg-orange-950/30",
    iconColor: "text-orange-600 dark:text-orange-400",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 22h12"/><path d="M5 22V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v18"/><path d="M13 14h6a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-6"/><path d="M19 14v5a3 3 0 0 1-3 3"/><path d="M5 10h8"/>
      </svg>
    ),
  },
  {
    title: "Statistik",
    text: "Kilometer, Tankstopps und Kosten pro Person – übersichtlich ausgewertet für jedes Auto.",
    iconBg: "bg-violet-50 dark:bg-violet-950/30",
    iconColor: "text-violet-600 dark:text-violet-400",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"></line>
        <line x1="12" y1="20" x2="12" y2="4"></line>
        <line x1="6" y1="20" x2="6" y2="14"></line>
      </svg>
    ),
  },
  {
    title: "Mitteilungen",
    text: "Push-Benachrichtigung, sobald jemand eine Fahrt einträgt, reserviert oder tankt.",
    iconBg: "bg-red-50 dark:bg-red-950/30",
    iconColor: "text-red-500 dark:text-red-400",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
      </svg>
    ),
  },
];

const STEPS = [
  {
    title: "Mit Google anmelden",
    text: "Kein neues Konto, kein Passwort – die Anmeldung läuft über Google.",
  },
  {
    title: "Auto erstellen oder beitreten",
    text: "Ein Auto anlegen und die anderen per Einladungslink dazuholen – oder selbst über einen Link beitreten.",
  },
  {
    title: "Fahrten eintragen",
    text: "Nach der Fahrt kurz den neuen KM-Stand erfassen. Mehr braucht es nicht.",
  },
  {
    title: "Tanken und abrechnen",
    text: "Betrag eingeben – die App rechnet aus, wer wie viel beisteuert.",
  },
];

export default function Landing() {
  // html/body haben global overflow:hidden - die Landingpage scrollt deshalb
  // in ihrem eigenen Container
  return (
    <main className="w-full h-dvh overflow-y-auto bg-gray-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <div className="max-w-md lg:max-w-5xl mx-auto px-4 lg:px-8 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-[calc(2.5rem+env(safe-area-inset-bottom))] flex flex-col gap-8 lg:gap-12">

        {/* HERO */}
        <div className="bg-white dark:bg-zinc-900 p-8 lg:p-14 rounded-[2.5rem] shadow-xl dark:shadow-zinc-950/40 border border-gray-100 dark:border-zinc-800/80 text-center">
          <h1 className="text-4xl lg:text-6xl font-black tracking-tight italic uppercase">
            {"CARSHARE".split("").map((char, index) => (
              <span key={index} style={{ color: PRESET_COLORS[index % PRESET_COLORS.length] }}>
                {char}
              </span>
            ))}
          </h1>
          <p className="text-xl lg:text-3xl font-black italic text-gray-800 dark:text-zinc-100 mt-4 leading-tight">
            Das gemeinsame Fahrtenbuch für euer Auto
          </p>
          <p className="text-sm lg:text-base font-bold text-gray-400 dark:text-zinc-500 mt-3 leading-relaxed lg:max-w-2xl lg:mx-auto">
            Fahrten erfassen, das Auto reservieren und Tankkosten fair aufteilen – für Familien, WGs und alle, die sich ein Auto teilen.
          </p>
          <div className="mt-6 lg:max-w-sm lg:mx-auto">
            <GoogleButton />
          </div>
          <p className="text-[10px] font-bold text-gray-300 dark:text-zinc-600 uppercase tracking-widest mt-4">
            Kostenlos · Keine Werbung
          </p>
        </div>

        {/* FEATURES */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-3 tracking-widest ml-4">
            Was die App kann
          </h2>
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 p-5 rounded-3xl flex items-start gap-4 shadow-sm">
                <div className={`p-3 rounded-2xl shrink-0 ${f.iconBg} ${f.iconColor}`}>
                  {f.icon}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-black text-gray-800 dark:text-zinc-100 uppercase italic tracking-tight">{f.title}</span>
                  <span className="text-sm font-bold text-gray-400 dark:text-zinc-500 mt-1 leading-relaxed">{f.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop: Schritte und Installation nebeneinander */}
        <div className="flex flex-col gap-8 lg:grid lg:grid-cols-2 lg:gap-12 lg:items-start">

        {/* SO FUNKTIONIERT'S */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-3 tracking-widest ml-4">
            So funktioniert&apos;s
          </h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 p-6 rounded-[2.5rem] shadow-sm flex flex-col gap-5">
            {STEPS.map((step, i) => (
              <div key={step.title} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-zinc-800 text-white font-black flex items-center justify-center text-sm shrink-0">
                  {i + 1}
                </div>
                <div className="flex flex-col text-left">
                  <span className="font-black text-gray-800 dark:text-zinc-100 text-sm uppercase italic tracking-tight">{step.title}</span>
                  <span className="text-sm font-bold text-gray-400 dark:text-zinc-500 mt-0.5 leading-relaxed">{step.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ALS APP INSTALLIEREN */}
        <div>
          <h2 className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase mb-3 tracking-widest ml-4">
            Als App installieren
          </h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 p-6 rounded-[2.5rem] shadow-sm text-left">
            <p className="text-sm font-bold text-gray-400 dark:text-zinc-500 leading-relaxed">
              CarShare braucht keinen App Store: Die Web-App lässt sich direkt auf den Home-Bildschirm legen und startet dann im Vollbild wie eine normale App.
            </p>

            <div className="mt-5 flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-gray-800 dark:text-zinc-100 text-sm uppercase italic tracking-tight">iPhone (Safari)</span>
                  <span className="text-sm font-bold text-gray-400 dark:text-zinc-500 mt-0.5 leading-relaxed">
                    Teilen-Symbol antippen, dann «Zum Home-Bildschirm» wählen und die App ab jetzt von dort starten.
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="p-3 rounded-2xl bg-green-50 dark:bg-green-950/30 text-green-600 dark:text-green-400 shrink-0">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                </div>
                <div className="flex flex-col">
                  <span className="font-black text-gray-800 dark:text-zinc-100 text-sm uppercase italic tracking-tight">Android (Chrome)</span>
                  <span className="text-sm font-bold text-gray-400 dark:text-zinc-500 mt-0.5 leading-relaxed">
                    Menü öffnen und «App installieren» bzw. «Zum Startbildschirm hinzufügen» wählen.
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800/80 p-4 rounded-2xl">
              <p className="text-xs font-bold text-gray-500 dark:text-zinc-400 leading-relaxed">
                <span className="font-black uppercase text-gray-700 dark:text-zinc-300">Tipp:</span> Nach der Installation im Profil die Push-Mitteilungen aktivieren – auf dem iPhone funktionieren sie nur in der installierten App.
              </p>
            </div>
          </div>
        </div>

        </div>

        {/* CTA */}
        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-xl dark:shadow-zinc-950/40 border border-gray-100 dark:border-zinc-800/80 text-center lg:max-w-xl lg:w-full lg:mx-auto">
          <p className="text-gray-400 dark:text-zinc-500 font-bold mb-6 italic uppercase tracking-tighter">
            Bereit für die Fahrt?
          </p>
          <div className="lg:max-w-sm lg:mx-auto">
            <GoogleButton />
          </div>
        </div>

        <p className="text-center text-[10px] font-bold text-gray-300 dark:text-zinc-600 uppercase tracking-widest">
          CarShare · Fahrtenbuch für geteilte Autos
        </p>
      </div>
    </main>
  );
}
