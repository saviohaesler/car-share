"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface UserProfile {
  uid?: string;
  displayName: string;
  color: string;
}

// Lädt die Profile der übergebenen UIDs als einzelne Dokument-Subscriptions,
// statt die komplette users-Collection zu streamen. Dadurch können die
// Firestore-Regeln das Auflisten aller Nutzer verbieten (kein Enumerieren).
export function useUserProfiles(uids: (string | undefined | null)[]) {
  const [profiles, setProfiles] = useState<Record<string, UserProfile>>({});
  const key = Array.from(new Set(uids.filter((u): u is string => !!u)))
    .sort()
    .join("\n");

  useEffect(() => {
    if (!key) return;
    const unsubs = key.split("\n").map((uid) =>
      onSnapshot(
        doc(db, "users", uid),
        (snap) => {
          if (snap.exists()) {
            setProfiles((prev) => ({ ...prev, [uid]: snap.data() as UserProfile }));
          }
        },
        () => {} // Fehlende Leserechte einzelner Profile dürfen die Seite nicht stören
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return profiles;
}
