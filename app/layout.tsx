import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
import Script from "next/script";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Verhindert das Auto-Zoomen von iOS beim Fokussieren von Eingabefeldern
  // (<16px Schrift), das die fixierte Tab-Bar aus dem Bild schiebt.
  // Manuelles Pinch-Zoomen bleibt auf iOS trotzdem möglich.
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "CarShare App",
  description: "Fahrtenbuch für geteilte Autos",
  // Damit "Zum Home-Bildschirm" auf dem iPhone das App-Icon (statt eines
  // Screenshots) verwendet. Das Manifest wird von app/manifest.ts automatisch
  // verlinkt.
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
  // Bewusst KEINE Legacy-Metas (apple-mobile-web-app-capable / status-bar-style):
  // iOS 26 bemisst das Web-App-Fenster mit ihnen um die Statusleistenhöhe zu kurz
  // (toter Balken unten). Der Standalone-Modus kommt allein aus dem Web-Manifest
  // (app/manifest.ts, display: "standalone"), wie bei modernen PWAs üblich.
  appleWebApp: {
    title: "CarShare",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ViewTransitions>
      <html
        lang="de"
        className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
        suppressHydrationWarning
      >
        <head>
          {/* Next.js rendert bei appleWebApp.capable nur noch "mobile-web-app-capable";
              iOS braucht für den Vollbild-Start vom Home-Bildschirm aber weiterhin
              den Apple-eigenen Tag – sonst bleibt unten ein Systembalken stehen. */}
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta
            id="meta-theme-color"
            name="theme-color"
            content="#f9fafb"
            suppressHydrationWarning
          />
        </head>
        <body className="min-h-full flex flex-col">
          {children}
          <Script id="theme-init" strategy="beforeInteractive">
            {`
              (function() {
                try {
                  const savedTheme = localStorage.getItem("theme");
                  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
                  const isDark = savedTheme === "dark" || (!savedTheme && prefersDark);
                  if (isDark) {
                    document.documentElement.classList.add("dark");
                  } else {
                    document.documentElement.classList.remove("dark");
                  }
                  const meta = document.getElementById("meta-theme-color");
                  if (meta) {
                    meta.setAttribute("content", isDark ? "#09090b" : "#f9fafb");
                  }
                } catch (_) {}
              })();
            `}
          </Script>
        </body>
      </html>
    </ViewTransitions>
  );
}
