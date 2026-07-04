"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "dark" || savedTheme === "light") return savedTheme;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  // Dynamic theme-color meta synchronization for PWAs/iOS Safari
  let meta = document.getElementById("meta-theme-color");
  if (!meta) {
    meta = document.createElement("meta");
    meta.id = "meta-theme-color";
    meta.setAttribute("name", "theme-color");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", theme === "dark" ? "#09090b" : "#f9fafb");
}

// Shared theme logic for all pages (replaces the previously duplicated
// useEffect blocks). The initial value comes from localStorage or the
// system preference; the inline script in RootLayout prevents FOUC.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(resolveInitialTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme: Theme = theme === "light" ? "dark" : "light";
    localStorage.setItem("theme", nextTheme);
    setTheme(nextTheme);
  };

  return { theme, toggleTheme };
}
