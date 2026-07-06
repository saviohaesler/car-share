"use client";

import { useEffect, useState } from "react";

// TEMPORÄR: Diagnose-Overlay für das PWA-Vollbild-Problem auf iOS.
// Zeigt die echten Viewport-Werte des Geräts an; das Overlay selbst ist
// fixed am unteren Rand – so sieht man direkt, wo "unten" für die Seite ist.
// Nach der Diagnose wieder entfernen.
export function ViewportDebug() {
  const [info, setInfo] = useState("lade…");

  useEffect(() => {
    const probe = document.createElement("div");
    probe.style.cssText =
      "position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);left:0;width:1px;visibility:hidden;pointer-events:none;";
    document.body.appendChild(probe);

    const update = () => {
      const r = probe.getBoundingClientRect();
      const vv = window.visualViewport;
      const nav = navigator as Navigator & { standalone?: boolean };
      setInfo(
        [
          `standalone: ${String(nav.standalone)} | display-mode standalone: ${window.matchMedia("(display-mode: standalone)").matches}`,
          `inner: ${window.innerWidth}×${window.innerHeight} | screen: ${screen.width}×${screen.height}`,
          `visualViewport: ${vv ? `${Math.round(vv.width)}×${Math.round(vv.height)}, offsetTop ${Math.round(vv.offsetTop)}` : "-"}`,
          `safe-area top: ${Math.round(r.top)} | bottom: ${Math.round(window.innerHeight - r.bottom)}`,
          `UA: …${navigator.userAgent.slice(-70)}`,
        ].join("\n")
      );
    };

    update();
    const t = setInterval(update, 2000);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      clearInterval(t);
      probe.remove();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, []);

  return (
    <pre
      style={{
        position: "fixed",
        left: 8,
        right: 8,
        bottom: 8,
        zIndex: 9999,
        background: "rgba(0,0,0,0.8)",
        color: "#4ade80",
        fontSize: 10,
        lineHeight: 1.5,
        padding: 8,
        borderRadius: 8,
        whiteSpace: "pre-wrap",
        pointerEvents: "none",
      }}
    >
      {info}
    </pre>
  );
}
