import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ViewTransitions } from "next-view-transitions";
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
  maximumScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "CarShare App",
  description: "Fahrtenbuch für geteilte Autos",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
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
          <meta
            id="meta-theme-color"
            name="theme-color"
            content="#f9fafb"
            suppressHydrationWarning
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
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
              `,
            }}
          />
        </head>
        <body className="min-h-full flex flex-col">{children}</body>
      </html>
    </ViewTransitions>
  );
}
