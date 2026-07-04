// app/invite/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { db, auth, googleProvider } from "../../../lib/firebase";
import { signInWithPopup, User } from "firebase/auth";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTheme } from "../../../lib/useTheme";

const PRESET_COLORS = [
  "#ef4444", // Red
  "#f97316", // Orange
  "#fbbf24", // Amber
  "#10b981", // Green
  "#06b6d4", // Cyan
  "#3b82f6", // Blue
  "#8b5cf6", // Violet
  "#ec4899"  // Pink
];

export default function InvitePage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  
  const [carName, setCarName] = useState("Loading...");
  const [carId, setCarId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  useTheme();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Auto-Initialize user profile document inside Firestore if it doesn't exist
        const userRef = doc(db, "users", currentUser.uid);
        const userDoc = await getDoc(userRef);
        if (!userDoc.exists()) {
          const profileName = currentUser.displayName || "New Member";
          const profileColor = PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)];
          await setDoc(userRef, {
            uid: currentUser.uid,
            displayName: profileName,
            color: profileColor
          }, { merge: true });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchInvite = async () => {
      // New model: The link contains a random invitation token
      try {
        const inviteSnap = await getDoc(doc(db, "invites", resolvedParams.id));
        if (inviteSnap.exists()) {
          const invite = inviteSnap.data();
          if (invite.expiresAt?.toDate && invite.expiresAt.toDate() < new Date()) {
            setErrorMsg("This invitation has expired. Please request a new link.");
            return;
          }
          setCarId(invite.carId);
          setCarName(invite.carName || "a shared car");
          return;
        }
      } catch (error) {
        console.warn("Could not load invitation:", error);
      }

      // Legacy link (/invite/{carId}): Joining via this link is no longer possible,
      // but existing members will still be redirected correctly.
      setCarId(resolvedParams.id);
      try {
        const docSnap = await getDoc(doc(db, "cars", resolvedParams.id));
        setCarName(docSnap.exists() ? docSnap.data().name : "a shared car");
      } catch {
        // Permission denied is expected for guests or non-members
        setCarName("a shared car");
      }
    };
    fetchInvite();
  }, [resolvedParams.id]);

  const handleLogin = async () => {
    try { await signInWithPopup(auth, googleProvider); } 
    catch (error) { console.error("Login Error:", error); }
  };

  const handleJoinCar = async () => {
    if (!user || !carId) return;
    setIsJoining(true);

    try {
      // Already a member? Then redirect immediately without write access
      const carSnap = await getDoc(doc(db, "cars", carId)).catch(() => null);
      if (!(carSnap?.exists() && (carSnap.data().members || []).includes(user.uid))) {
        // The token is sent along so that the Firestore rules can
        // verify the invitation server-side (valid & not expired)
        await updateDoc(doc(db, "cars", carId), {
          members: arrayUnion(user.uid),
          joinToken: resolvedParams.id
        });
      }

      // CORRECTED LINK: Go directly to the log in the ID folder
      router.push(`/${carId}/log`);
    } catch (error) {
      console.error("Error joining:", error);
      setErrorMsg("Error joining. The link is invalid or expired.");
    }
    setIsJoining(false);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-gray-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-xl dark:shadow-zinc-950/40 text-center max-w-md w-full border border-gray-100 dark:border-zinc-800/80">
        
        <h1 className="text-3xl font-black text-gray-800 dark:text-zinc-100 tracking-tight italic uppercase mb-8">
          Invitation
        </h1>

        <div className="bg-gray-50 dark:bg-zinc-950/50 p-6 rounded-3xl mb-8 border border-gray-100 dark:border-zinc-800/80">
          {errorMsg ? (
            <p className="text-red-500 dark:text-red-400 font-bold italic">{errorMsg}</p>
          ) : (
            <>
              <p className="text-gray-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-widest mb-2">You were invited to</p>
              <h2 className="text-2xl font-black text-gray-900 dark:text-zinc-100 italic uppercase">
                {carName}
              </h2>
            </>
          )}
        </div>

        {!errorMsg && (
          <div className="flex flex-col gap-4">
            {!user ? (
              <div className="flex flex-col items-center">
                <p className="text-sm text-gray-500 dark:text-zinc-400 font-medium italic mb-6">
                  Sign in to join the group.
                </p>
                <button 
                  onClick={handleLogin}
                  className="flex items-center justify-center gap-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-gray-700 dark:text-zinc-300 font-bold py-4 px-8 rounded-full w-full shadow-sm hover:shadow-md active:scale-95 transition text-lg select-none"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" style={{ backgroundColor: 'transparent' }}>
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-col items-center gap-1 mb-4">
                   <p className="text-xs font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-tighter">Signed in as</p>
                   <p className="font-black text-gray-800 dark:text-zinc-100 text-lg">{user.displayName}</p>
                </div>
                
                <button 
                  onClick={handleJoinCar}
                  disabled={isJoining}
                  className="bg-gray-800 dark:bg-zinc-100 text-white dark:text-zinc-950 font-black py-5 rounded-[2rem] w-full shadow-xl active:scale-95 transition text-lg uppercase italic disabled:opacity-50"
                >
                  {isJoining ? "Joining..." : "Join Now"}
                </button>

                <p className="text-gray-400 dark:text-zinc-500 text-xs font-bold uppercase mt-2">
                  Not your account? <button onClick={() => auth.signOut()} className="text-red-500 dark:text-red-400 hover:underline">Sign out</button>
                </p>
              </>
            )}
          </div>
        )}

        {errorMsg && (
          <Link 
            href="/" 
            className="inline-block bg-gray-800 dark:bg-zinc-100 text-white dark:text-zinc-950 font-bold py-4 px-8 rounded-2xl active:scale-95 transition uppercase text-sm"
          >
            Back to Home
          </Link>
        )}
      </div>
      
      <p className="mt-8 text-gray-300 dark:text-zinc-800 font-black italic tracking-tighter uppercase text-xs">Car Share App</p>
    </main>
  );
}