"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";

export interface UserProfile {
  uid?: string;
  displayName: string;
  color: string;
}

// Loads the profiles of the given UIDs as individual document subscriptions
// instead of streaming the entire users collection. This allows Firestore rules
// to forbid listing all users (prevents enumeration).
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
        () => {} // Missing read permissions for individual profiles should not break the page
      )
    );
    return () => unsubs.forEach((u) => u());
  }, [key]);

  return profiles;
}
