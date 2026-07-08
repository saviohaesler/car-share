"use client";

import React, { use } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useViewportReset } from "../../lib/useViewportReset";
import { usePushSync } from "../../lib/push";

export default function CarLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const pathname = usePathname();
  useViewportReset();
  // Hinterlegt das Push-Abo auch bei Autos, denen man erst nach dem
  // Aktivieren des Schalters beigetreten ist
  usePushSync(resolvedParams.id);

  const isLogActive = pathname?.endsWith("/log");
  const isCalendarActive = pathname?.endsWith("/calendar");
  const isMapActive = pathname?.endsWith("/map");
  const isStatsActive = pathname?.endsWith("/stats");

  return (
    <div className="w-full h-dvh overflow-hidden flex flex-col bg-gray-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 relative transition-colors duration-200">
      
      {/* Page content wrapper */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {children}
      </div>

      {/* Persistent Static Tab Bar */}
      <nav
        style={{ viewTransitionName: "bottom-nav" }}
        className="relative shrink-0 w-full h-[calc(4rem+env(safe-area-inset-bottom))] pb-[calc(env(safe-area-inset-bottom)*0.4)] pt-2 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-t border-gray-200 dark:border-zinc-800/80 flex justify-center items-stretch z-50 px-6 text-center"
      >
        {/* Auf dem Desktop bleiben die Tabs mittig gebündelt statt über die
            ganze Breite verteilt (max-w-md greift auf dem Handy nicht) */}
        <div className="flex items-stretch w-full max-w-md">
        <Link 
          href={`/${resolvedParams.id}/log`} 
          className={`flex-1 flex flex-col items-center justify-center gap-1 active:opacity-40 transition ${
            isLogActive 
              ? "text-blue-600 dark:text-blue-400 font-black" 
              : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <line x1="10" y1="9" x2="8" y2="9"></line>
            </svg>
          </div>
          <span className={`text-[10px] uppercase tracking-widest ${isLogActive ? "font-black" : "font-bold"}`}>Fahrten</span>
        </Link>

        <Link 
          href={`/${resolvedParams.id}/calendar`} 
          className={`flex-1 flex flex-col items-center justify-center gap-1 active:opacity-40 transition ${
            isCalendarActive 
              ? "text-blue-600 dark:text-blue-400 font-black" 
              : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="16" y1="2" x2="16" y2="6"></line>
              <line x1="8" y1="2" x2="8" y2="6"></line>
              <line x1="3" y1="10" x2="21" y2="10"></line>
            </svg>
          </div>
          <span className={`text-[10px] uppercase tracking-widest ${isCalendarActive ? "font-black" : "font-bold"}`}>Kalender</span>
        </Link>

        <Link
          href={`/${resolvedParams.id}/map`}
          className={`flex-1 flex flex-col items-center justify-center gap-1 active:opacity-40 transition ${
            isMapActive
              ? "text-blue-600 dark:text-blue-400 font-black"
              : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3"></circle>
            </svg>
          </div>
          <span className={`text-[10px] uppercase tracking-widest ${isMapActive ? "font-black" : "font-bold"}`}>Karte</span>
        </Link>

        <Link
          href={`/${resolvedParams.id}/stats`}
          className={`flex-1 flex flex-col items-center justify-center gap-1 active:opacity-40 transition ${
            isStatsActive 
              ? "text-blue-600 dark:text-blue-400 font-black" 
              : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
          }`}
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </div>
          <span className={`text-[10px] uppercase tracking-widest ${isStatsActive ? "font-black" : "font-bold"}`}>Statistik</span>
        </Link>
        </div>
      </nav>
    </div>
  );
}
