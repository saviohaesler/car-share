// app/page.tsx
"use client";

import { signInWithPopup, User } from "firebase/auth";
import { auth, googleProvider, db } from "../lib/firebase";
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, setDoc, getDoc, deleteDoc, updateDoc, arrayRemove } from "firebase/firestore"; 
import { useEffect, useState } from "react";
import Link from "next/link";

interface Car {
  id: string;
  name: string;
  ownerId: string;
  members: string[];
  initialKm?: number;
}

const PRESET_COLORS = ["#fbbf24", "#ef4444", "#ec4899", "#8b5cf6", "#3b82f6", "#10b981"];

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [carName, setCarName] = useState("");
  const [newCarInitialKm, setNewCarInitialKm] = useState("");
  const [cars, setCars] = useState<Car[]>([]);
  const [displayName, setDisplayName] = useState("");
  const [userColor, setUserColor] = useState(PRESET_COLORS[0]);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, any>>({});
  const [isEditCarModalOpen, setIsEditCarModalOpen] = useState(false);
  const [editCarData, setEditCarData] = useState<{id: string, name: string, initialKm: string} | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          setDisplayName(userDoc.data().displayName || currentUser.displayName || "");
          setUserColor(userDoc.data().color || PRESET_COLORS[0]);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    return onSnapshot(collection(db, "users"), (snapshot) => {
      const profiles: any = {};
      snapshot.docs.forEach(doc => { profiles[doc.id] = doc.data(); });
      setUserProfiles(profiles);
    });
  }, [user]);

  useEffect(() => {
    if (!user) { setCars([]); return; }
    const q = query(collection(db, "cars"), where("members", "array-contains", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCars(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Car)));
    });
    return () => unsubscribe();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setIsSavingProfile(true);
    await setDoc(doc(db, "users", user.uid), { displayName, color: userColor, uid: user.uid }, { merge: true });
    setIsSavingProfile(false);
    setIsProfileModalOpen(false);
  };

  const handleCreateCar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carName.trim() || !user) return;
    await addDoc(collection(db, "cars"), {
      name: carName,
      initialKm: Number(newCarInitialKm) || 0,
      ownerId: user.uid,
      members: [user.uid],
      createdAt: serverTimestamp(),
    });
    setCarName("");
    setNewCarInitialKm("");
  };

  const openEditCarModal = (car: Car) => {
    setEditCarData({
      id: car.id,
      name: car.name,
      initialKm: car.initialKm?.toString() || "0"
    });
    setIsEditCarModalOpen(true);
  };

  const saveCarSettings = async () => {
    if (!editCarData || !editCarData.name.trim()) return;
    await updateDoc(doc(db, "cars", editCarData.id), {
      name: editCarData.name,
      initialKm: Number(editCarData.initialKm) || 0
    });
    setIsEditCarModalOpen(false);
  };

  const handleDeleteCar = async () => {
    if (!editCarData) return;
    if (window.confirm(`Auto "${editCarData.name}" wirklich unwiderruflich löschen?`)) {
      await deleteDoc(doc(db, "cars", editCarData.id));
      setIsEditCarModalOpen(false);
    }
  };

  const handleCopyInvite = async (e: React.MouseEvent, carId: string) => {
    e.preventDefault(); e.stopPropagation();
    const inviteLink = `${window.location.origin}/invite/${carId}`;
    
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(inviteLink);
        alert("Einladungslink kopiert!");
        return;
      } catch (err) { console.error(err); }
    }
    // Fallback für In-App Browser
    window.prompt("Link kopieren:", inviteLink);
  };

  const removeMember = async (carId: string, memberId: string) => {
    if (window.confirm("Mitglied wirklich entfernen?")) {
      await updateDoc(doc(db, "cars", carId), { members: arrayRemove(memberId) });
      if (memberId === user?.uid) setIsMemberModalOpen(false);
    }
  };

  return (
    <main className="w-full h-[100dvh] flex flex-col items-center p-4 bg-gray-50 overflow-y-auto relative">
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl max-w-md w-full text-center border border-gray-100 my-auto">
        
        <div className="flex justify-between items-center mb-8 px-2">
          <div className="w-10"></div>
          <h1 className="text-3xl font-black tracking-tight italic uppercase">
            {"CARSHARE".split("").map((char, index) => (
              <span key={index} style={{ color: PRESET_COLORS[index % PRESET_COLORS.length] }}>
                {char}
              </span>
            ))}
          </h1>
          {user ? (
            <button onClick={() => setIsProfileModalOpen(true)} className="p-2 bg-gray-50 rounded-xl active:scale-90 transition">
               <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          ) : <div className="w-10"></div>}
        </div>
        
        {user ? (
          <div className="flex flex-col gap-8">
            <div className="text-center">
              <p className="text-2xl font-black italic text-gray-800">
                Hallo <span style={{ color: userColor }}>{displayName}</span>
              </p>
            </div>

            <div className="text-left">
              <h2 className="text-xs font-bold text-gray-400 uppercase mb-4 tracking-widest ml-1 text-gray-900">Meine Autos</h2>
              <div className="flex flex-col gap-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
                {cars.map((car) => (
                  <div key={car.id} className="relative">
                    <Link href={`/${car.id}/log`} className="bg-white border-2 border-gray-100 p-5 rounded-3xl flex justify-between items-center transition shadow-sm active:scale-[0.98]">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-800 text-lg">{car.name}</span>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSelectedCar(car); setIsMemberModalOpen(true); }} className="text-xs font-bold text-blue-500 mt-1 text-left uppercase tracking-tighter">
                          {car.members.length} Personen
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => handleCopyInvite(e, car.id)} className="p-2 bg-blue-50 rounded-xl active:scale-90 transition">
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                        </button>
                        {car.ownerId === user.uid && (
                          <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEditCarModal(car); }} className="p-2 bg-gray-100 rounded-xl active:scale-90 transition">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                          </button>
                        )}
                        <span className="text-gray-300 font-black ml-1">→</span>
                      </div>
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreateCar} className="flex flex-col gap-2 bg-gray-50 p-4 rounded-3xl border border-dashed border-gray-300">
               <input type="text" placeholder="Auto Name..." value={carName} onChange={(e) => setCarName(e.target.value)} className="bg-white p-4 rounded-2xl w-full font-bold text-gray-900 shadow-sm outline-none border border-gray-100 focus:border-blue-500 transition" required />
               <input type="number" placeholder="Start KM-Stand..." value={newCarInitialKm} onChange={(e) => setNewCarInitialKm(e.target.value)} className="bg-white p-4 rounded-2xl w-full font-bold text-gray-900 shadow-sm outline-none border border-gray-100 focus:border-blue-500 transition" />
               <button type="submit" className="bg-gray-800 text-white p-4 rounded-2xl font-bold active:scale-95 transition mt-1">Hinzufügen</button>
            </form>

            <button onClick={() => auth.signOut()} className="bg-red-50 text-red-600 font-bold py-4 rounded-2xl active:scale-95 transition uppercase text-xs tracking-widest mt-4">Abmelden</button>
          </div>
        ) : (
          <div className="py-8 flex flex-col items-center">
            <p className="text-gray-400 font-bold mb-8 italic uppercase tracking-tighter">Bereit für die Fahrt?</p>
            <button onClick={() => signInWithPopup(auth, googleProvider)} className="flex items-center justify-center gap-4 bg-white border border-gray-200 text-gray-700 font-bold py-4 px-8 rounded-full w-full shadow-sm hover:shadow-md active:scale-95 transition text-lg">
              <svg width="24" height="24" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Weiter mit Google
            </button>
          </div>
        )}
      </div>

      {/* PROFIL MODAL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-gray-900">
            <h2 className="text-xl font-black mb-6 uppercase italic text-center text-black">Profil</h2>
            <div className="flex flex-col gap-6">
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Anzeigename</label>
                <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full p-4 rounded-xl bg-white border-2 border-gray-200 font-black text-gray-900 mt-2 outline-none focus:border-blue-500 transition-colors shadow-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-400 uppercase ml-1">Kalender Farbe</label>
                <div className="flex flex-wrap gap-2 mt-2 p-1">
                  {PRESET_COLORS.map(color => (
                    <button key={color} onClick={() => setUserColor(color)} className={`w-10 h-10 rounded-full transition-all ${userColor === color ? 'scale-110 ring-4 ring-offset-2 ring-gray-200' : 'opacity-50'}`} style={{ backgroundColor: color }} />
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button onClick={saveProfile} className="bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition uppercase italic">Speichern</button>
                <button onClick={() => setIsProfileModalOpen(false)} className="text-gray-400 font-bold text-sm uppercase text-center mt-2">Schließen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTO BEARBEITEN MODAL */}
      {isEditCarModalOpen && editCarData && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-gray-900">
            <h2 className="text-xl font-black mb-6 text-center italic uppercase tracking-tighter text-black">Auto Einstellungen</h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Name</label>
                <input type="text" value={editCarData.name} onChange={(e) => setEditCarData({...editCarData, name: e.target.value})} className="w-full p-4 rounded-xl bg-white border-2 border-gray-200 font-black text-gray-900 outline-none focus:border-blue-500 shadow-sm" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 tracking-widest">Start KM-Stand</label>
                <input type="number" value={editCarData.initialKm} onChange={(e) => setEditCarData({...editCarData, initialKm: e.target.value})} className="w-full p-4 rounded-xl bg-white border-2 border-gray-200 font-black text-gray-900 outline-none focus:border-blue-500 shadow-sm" />
              </div>
              <div className="flex flex-col gap-2 mt-4">
                <button onClick={saveCarSettings} className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-lg active:scale-95 transition uppercase italic">Speichern</button>
                <button onClick={() => setIsEditCarModalOpen(false)} className="text-gray-400 font-bold text-sm uppercase text-center mt-2">Schließen</button>
                <button onClick={handleDeleteCar} className="w-full bg-red-50 text-red-500 font-bold py-3 rounded-xl uppercase text-[10px] mt-2 border border-red-100">Auto löschen</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PERSONEN MODAL */}
      {isMemberModalOpen && selectedCar && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl w-full max-w-sm text-gray-900">
            <h2 className="text-xl font-black mb-4 text-center italic uppercase text-black">Personen</h2>
            <div className="flex flex-col gap-3 mb-6">
              {selectedCar.members.map((mId) => (
                <div key={mId} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: userProfiles[mId]?.color || '#ccc' }}></div>
                    <span className="font-bold text-sm text-black">{userProfiles[mId]?.displayName || 'Lädt...'}</span>
                  </div>
                  {selectedCar.ownerId === user?.uid && mId !== user?.uid && <button onClick={() => removeMember(selectedCar.id, mId)} className="text-[10px] bg-red-100 text-red-500 px-3 py-1 rounded-lg font-black uppercase">Entfernen</button>}
                  {mId === user?.uid && mId !== selectedCar.ownerId && <button onClick={() => removeMember(selectedCar.id, mId)} className="text-[10px] bg-gray-200 text-gray-500 px-3 py-1 rounded-lg font-black uppercase">Verlassen</button>}
                </div>
              ))}
            </div>
            <button onClick={() => setIsMemberModalOpen(false)} className="w-full bg-gray-100 text-gray-800 font-bold py-4 rounded-2xl uppercase text-xs">Schließen</button>
          </div>
        </div>
      )}

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </main>
  );
}