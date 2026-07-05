"use client";

import { useEffect } from "react";

// iOS (v. a. als installierte PWA): Nach dem Schliessen der Bildschirmtastatur
// bleibt der Viewport manchmal nach oben verschoben stehen, wodurch fix
// positionierte Elemente (z. B. die untere Tab-Bar) über dem unteren Rand
// "schweben". Sobald kein Eingabefeld mehr fokussiert ist, zieht ein
// Scroll-Reset den Viewport wieder an seine korrekte Position.
export function useViewportReset() {
  useEffect(() => {
    let raf = 0;
    const reset = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const el = document.activeElement;
        // Solange ein Eingabefeld fokussiert ist (Tastatur offen), nicht eingreifen
        if (el instanceof HTMLElement && el.matches("input, textarea, select")) return;
        window.scrollTo(0, 0);
      });
    };
    document.addEventListener("focusout", reset);
    window.visualViewport?.addEventListener("resize", reset);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("focusout", reset);
      window.visualViewport?.removeEventListener("resize", reset);
    };
  }, []);
}
