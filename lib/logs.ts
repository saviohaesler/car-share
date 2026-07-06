import { Timestamp } from "firebase/firestore";
import type { UserProfile } from "./useUserProfiles";

export interface FuelDetail {
  name: string;
  userId?: string;
  dist: number;
  debt: number;
  color?: string;
}

export interface DriveLog {
  id: string;
  userName: string;
  userColor?: string;
  km: number;
  startKm?: number;
  description: string;
  timestamp: Timestamp | null;
  userId: string;
  type?: "drive" | "fuel";
  fuelAmount?: number;
  fuelDetails?: FuelDetail[];
}

// Formatiert KM-Stände mit Schweizer Tausendertrennzeichen (12'345)
export const formatKm = (km: number | string | undefined) => {
  if (km === undefined || km === null) return "?";
  return km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};

// Baut eine Name -> Google-Konto (uid) Zuordnung, damit Legacy-Einträge ohne
// gespeicherte userId weiterhin dem richtigen Konto zugeordnet werden. Alles
// wird pro uid aggregiert, nie pro rohem Anzeigenamen, damit dieselbe Person
// nicht doppelt auftaucht (z. B. "Savio" und "savio").
export function buildUidResolver(
  userProfiles: Record<string, UserProfile>,
  logs: DriveLog[]
): (userId?: string, name?: string) => string | undefined {
  const nameToUid: Record<string, string> = {};
  Object.entries(userProfiles).forEach(([uid, p]) => {
    if (p?.displayName) nameToUid[p.displayName.trim().toLowerCase()] = uid;
  });
  logs.forEach((l) => {
    if (l.userId && l.userName) {
      const k = l.userName.trim().toLowerCase();
      if (!(k in nameToUid)) nameToUid[k] = l.userId;
    }
    l.fuelDetails?.forEach((d) => {
      if (d.userId && d.name) {
        const k = d.name.trim().toLowerCase();
        if (!(k in nameToUid)) nameToUid[k] = d.userId;
      }
    });
  });

  return (userId?: string, name?: string) =>
    userId || (name ? nameToUid[name.trim().toLowerCase()] : undefined);
}
