// Gemeinsame Farbpalette für Profile und Kalender (zuvor in jeder Seite dupliziert).
export const PRESET_COLORS = [
  "#ef4444", // Rot
  "#f97316", // Orange
  "#fbbf24", // Amber
  "#10b981", // Grün
  "#06b6d4", // Cyan
  "#3b82f6", // Blau
  "#8b5cf6", // Violett
  "#ec4899", // Pink
];

export const randomPresetColor = () =>
  PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
