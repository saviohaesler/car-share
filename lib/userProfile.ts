import { doc, getDoc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "./firebase";
import { randomPresetColor } from "./constants";

// Legt das Firestore-Profil beim ersten Login automatisch an (zuvor in jeder
// Seite dupliziert) und liefert die gespeicherten Profilwerte zurück.
export async function ensureUserProfile(
  user: User
): Promise<{ displayName: string; color: string }> {
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const fallbackName = user.displayName || "Neues Mitglied";
  const fallbackColor = randomPresetColor();

  if (snap.exists()) {
    return {
      displayName: snap.data().displayName || fallbackName,
      color: snap.data().color || fallbackColor,
    };
  }

  const profile = { uid: user.uid, displayName: fallbackName, color: fallbackColor };
  await setDoc(userRef, profile, { merge: true });
  return { displayName: profile.displayName, color: profile.color };
}
