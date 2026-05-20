"use client";

import { useEffect, useState, use } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { User } from "firebase/auth";
import Link from "next/link";

interface FuelDetail {
  name: string;
  dist: number;
  debt: number;
  color?: string;
}

interface DriveLog {
  id: string;
  userName: string;
  userColor?: string;
  km: number;       
  startKm?: number; 
  description: string;
  timestamp: any;
  userId: string;
  type?: "drive" | "fuel";
  fuelAmount?: number;
  fuelDetails?: FuelDetail[];
}

const formatKm = (km: number | string | undefined) => {
  if (km === undefined || km === null) return '?';
  return km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};

export default function DriveLogPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{displayName: string, color: string} | null>(null);
  const [carName, setCarName] = useState("Lade...");
  const [initialKm, setInitialKm] = useState<number>(0);
  const [logs, setLogs] = useState<DriveLog[]>([]);
  
  const [startKm, setStartKm] = useState("");
  const [endKm, setEndKm] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLog, setEditingLog] = useState<DriveLog | null>(null);
  const [editStartKm, setEditStartKm] = useState("");
  const [editEndKm, setEditEndKm] = useState("");

  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [fuelPrice, setFuelPrice] = useState("");
  const [fuelSummary, setFuelSummary] = useState<FuelDetail[] | null>(null);

  const roundTo05 = (num: number) => {
    return Math.round(num * 20) / 20;
  };

  const getMaxKm = () => {
    if (logs.length === 0) return initialKm; 
    return Math.max(...logs.map(l => l.km));
  };

  // NEU: Logik für die Erfassen-Buttons
  const decrementStartKm = () => {
    const currentMin = getMaxKm();
    const currentVal = Number(startKm);
    if (currentVal > currentMin) {
        updateStartKm(String(currentVal - 1));
    }
  };

  const decrementEndKm = () => {
    const minEnd = Number(startKm);
    const currentVal = Number(endKm);
    if (currentVal > minEnd) {
        setEndKm(String(currentVal - 1));
    }
  };

  const updateStartKm = (val: string) => {
    setStartKm(val);
    if (Number(endKm) < Number(val)) {
      setEndKm(val);
    }
  };

  // NEU: Logik für die Edit-Buttons
  const decrementEditStartKm = () => {
    // Im Edit-Modus ist es schwieriger zu wissen, was das absolute Minimum ist (abhängig vom vorherigen Log)
    // Zur Sicherheit lassen wir es nicht unter initialKm fallen
    const currentVal = Number(editStartKm);
    if (currentVal > initialKm) {
        updateEditStartKm(String(currentVal - 1));
    }
  };

  const decrementEditEndKm = () => {
    const minEnd = Number(editStartKm);
    const currentVal = Number(editEndKm);
    if (currentVal > minEnd) {
        setEditEndKm(String(currentVal - 1));
    }
  };

  const updateEditStartKm = (val: string) => {
    setEditStartKm(val);
    if (Number(editEndKm) < Number(val)) {
      setEditEndKm(val);
    }
  };

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) { 
        window.location.href = "/"; 
      } else { 
        setUser(u);
        const userDoc = await getDoc(doc(db, "users", u.uid));
        if (userDoc.exists()) {
          setUserProfile({
            displayName: userDoc.data().displayName || u.displayName || "Unbekannt",
            color: userDoc.data().color || "#3b82f6"
          });
        }
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let unsubscribeLogs: () => void;

    const loadData = async () => {
      let initKm = 0;
      
      try {
        const docSnap = await getDoc(doc(db, "cars", resolvedParams.id));
        if (docSnap.exists()) {
          setCarName(docSnap.data().name);
          initKm = docSnap.data().initialKm || 0;
          setInitialKm(initKm);
        }
      } catch (error) { console.error(error); }

      const q = query(collection(db, "cars", resolvedParams.id, "logs"), orderBy("timestamp", "desc"));
      unsubscribeLogs = onSnapshot(q, (snapshot) => {
        const fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DriveLog));
        setLogs(fetchedLogs);
        
        if (fetchedLogs.length > 0) {
            const lastDrive = fetchedLogs.find(l => l.km);
            if (lastDrive) {
                const lastVal = lastDrive.km.toString();
                setStartKm(prev => prev === "" ? lastVal : prev);
                setEndKm(prev => prev === "" ? lastVal : prev);
            }
        } else {
            setStartKm(prev => prev === "" ? initKm.toString() : prev);
            setEndKm(prev => prev === "" ? initKm.toString() : prev);
        }
      });
    };

    loadData();

    return () => {
      if (unsubscribeLogs) unsubscribeLogs();
    };
  }, [resolvedParams.id, user]);

  const handleEditClick = (log: DriveLog) => {
    setEditingLog(log);
    setEditStartKm(log.startKm?.toString() || log.km.toString());
    setEditEndKm(log.km.toString());
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !startKm || !endKm || isSaving) return;
    
    const currentMax = getMaxKm();
    const sKm = Math.floor(Number(startKm));
    const eKm = Math.floor(Number(endKm));

    if (sKm < currentMax) {
        return alert(`Der Start-KM Stand (${formatKm(sKm)}) darf nicht kleiner sein als der bisherige Höchststand von ${formatKm(currentMax)} km.`);
    }
    if (eKm < sKm) {
        return alert("Der End-KM Stand muss höher oder gleich dem Start-KM sein!");
    }
    
    setIsSaving(true);
    try {
      await addDoc(collection(db, "cars", resolvedParams.id, "logs"), {
        userName: userProfile.displayName,
        userColor: userProfile.color,
        startKm: sKm,
        km: eKm,
        description: "", 
        timestamp: serverTimestamp(),
        userId: user.uid,
        type: "drive"
      });
      setEndKm(eKm.toString()); 
      setStartKm(eKm.toString());
    } catch (error) { console.error(error); }
    setIsSaving(false);
  };

  const handleFuelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !userProfile || !fuelPrice || isSaving) return;
    setIsSaving(true);

    const lastFuelIndex = logs.findIndex(l => l.type === "fuel");
    const relevantLogs = (lastFuelIndex === -1 ? logs : logs.slice(0, lastFuelIndex)).reverse();
    
    const userStats: { [key: string]: { name: string, totalDist: number, color: string } } = {};
    let lastKnownKm = lastFuelIndex !== -1 ? logs[lastFuelIndex].km : (relevantLogs.length > 0 ? relevantLogs[0].startKm || relevantLogs[0].km : initialKm);
    let gapDist = 0;

    relevantLogs.forEach(log => {
      const sKm = log.startKm ?? log.km;
      if (sKm > lastKnownKm) {
        gapDist += (sKm - lastKnownKm);
      }
      
      if (log.type === "drive" || !log.type) {
        const dist = log.km - sKm;
        if (!userStats[log.userId]) {
          userStats[log.userId] = { 
            name: log.userName, 
            totalDist: 0, 
            color: log.userColor || "#ccc" 
          };
        }
        userStats[log.userId].totalDist += dist;
      }
      lastKnownKm = log.km;
    });

    const totalUserDist = Object.values(userStats).reduce((sum, u) => sum + u.totalDist, 0);

    if (totalUserDist === 0) {
      alert("Keine protokollierten Fahrten zum Abrechnen gefunden!");
      setIsSaving(false); return;
    }

    const pricePerKm = Number(fuelPrice) / totalUserDist;

    const summary: FuelDetail[] = Object.values(userStats).map(u => ({
      name: u.name,
      dist: u.totalDist,
      debt: roundTo05(u.totalDist * pricePerKm),
      color: u.color
    }));

    if (gapDist > 0) {
      summary.push({
        name: "Lücke (nicht erfasst)",
        dist: gapDist,
        debt: 0,
        color: "#d1d5db"
      });
    }

    try {
      await addDoc(collection(db, "cars", resolvedParams.id, "logs"), {
        userName: userProfile.displayName,
        userColor: userProfile.color,
        km: Math.max(...relevantLogs.map(d => d.km), lastKnownKm),
        description: `Tankstopp: ${fuelPrice}.-`,
        fuelAmount: Number(fuelPrice),
        fuelDetails: summary,
        timestamp: serverTimestamp(),
        userId: user.uid,
        type: "fuel"
      });
      setFuelSummary(summary);
    } catch (error) { console.error(error); }
    setIsSaving(false);
  };

  const handleUpdateLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog || !user || editingLog.userId !== user.uid) return;
    const sKm = Math.floor(Number(editStartKm));
    const eKm = Math.floor(Number(editEndKm));
    if (eKm < sKm) return alert("End-KM muss höher als Start-KM sein!");
    try {
      await updateDoc(doc(db, "cars", resolvedParams.id, "logs", editingLog.id), {
        startKm: sKm,
        km: eKm
      });
      setIsModalOpen(false);
    } catch (error) { console.error(error); }
  };

  const handleDeleteLog = async () => {
    if (!editingLog || !user || editingLog.userId !== user.uid) return;
    if (window.confirm("Löschen?")) {
      try {
        await deleteDoc(doc(db, "cars", resolvedParams.id, "logs", editingLog.id));
        setIsModalOpen(false);
      } catch (error) { console.error(error); }
    }
  };

  if (!user) return null;

  return (
    <main className="w-full h-[100dvh] flex flex-col items-center p-4 bg-gray-50 text-black overflow-hidden relative">
      <div className="w-full max-w-md h-full flex flex-col pb-24">
        
        {/* HEADER EXAKT WIE IM KALENDER */}
        <div className="flex justify-between items-center mb-6">
          <Link href={`/`} className="bg-white p-3 px-5 rounded-2xl shadow-sm text-gray-700 font-bold text-sm active:scale-90 transition uppercase">
            Zurück
          </Link>
          <h1 className="text-xl font-black italic uppercase text-gray-800 tracking-tighter">
            {carName}
          </h1>
        </div>

        {/* ERFASSEN FORM */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl mb-6 border border-gray-100 shrink-0">
          <div className="flex justify-between items-center mb-4 ml-1">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Erfassen</h2>
            <button onClick={() => { setIsFuelModalOpen(true); setFuelSummary(null); setFuelPrice(""); }} className="bg-orange-100 text-orange-600 text-[10px] font-black px-3 py-1 rounded-full border border-orange-200 uppercase active:scale-95 transition flex items-center justify-center gap-1">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22h12"/><path d="M5 22V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v18"/><path d="M13 14h6a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-6"/><path d="M19 14v5a3 3 0 0 1-3 3"/><path d="M5 10h8"/></svg>
              Tanken
            </button>
          </div>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase">Start KM</label>
                    <div className="flex items-center gap-2">
                        {/* NEU: Disabled style wenn am Limit */}
                        <button type="button" onClick={decrementStartKm} disabled={Number(startKm) <= getMaxKm()} className="bg-gray-100 h-10 w-10 rounded-xl flex items-center justify-center font-bold active:bg-gray-200 text-sm disabled:opacity-50 disabled:active:bg-gray-100 transition-opacity">-</button>
                        <input type="number" step="1" value={startKm} onChange={(e) => updateStartKm(e.target.value)} className="bg-gray-50 h-10 flex-1 rounded-xl font-black text-center outline-none border border-gray-100 focus:border-green-500 transition no-spinner text-sm" required />
                        <button type="button" onClick={() => updateStartKm(String(Number(startKm) + 1))} className="bg-gray-100 h-10 w-10 rounded-xl flex items-center justify-center font-bold active:bg-gray-200 text-sm">+</button>
                    </div>
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase">Ende KM</label>
                    <div className="flex items-center gap-2">
                         {/* NEU: Disabled style wenn am Limit */}
                        <button type="button" onClick={decrementEndKm} disabled={Number(endKm) <= Number(startKm)} className="bg-gray-100 h-10 w-10 rounded-xl flex items-center justify-center font-bold active:bg-gray-200 text-sm disabled:opacity-50 disabled:active:bg-gray-100 transition-opacity">-</button>
                        <input type="number" step="1" value={endKm} onChange={(e) => setEndKm(e.target.value)} className="bg-gray-50 h-10 flex-1 rounded-xl font-black text-center outline-none border border-gray-100 focus:border-green-500 transition no-spinner text-sm" required />
                        <button type="button" onClick={() => setEndKm(String(Number(endKm) + 1))} className="bg-gray-100 h-10 w-10 rounded-xl flex items-center justify-center font-bold active:bg-gray-200 text-sm">+</button>
                    </div>
                </div>
            </div>
            <button type="submit" disabled={isSaving || !userProfile} className="bg-green-500 text-white p-3 rounded-xl font-black shadow-lg active:scale-95 transition uppercase italic tracking-widest mt-1 text-sm">
              {isSaving ? "Speichert..." : "Fahrt Speichern"}
            </button>
          </form>
        </div>

        {/* HISTORIE */}
        <div className="flex flex-col flex-1 overflow-hidden">
            <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-4 mb-4 shrink-0 text-left">Historie</h2>
            <div className="flex flex-col gap-4 overflow-y-auto pb-6 px-1 custom-scrollbar flex-1">
                
                {logs.length === 0 ? (
                  <div className="bg-white p-6 rounded-3xl border border-gray-100 text-center shadow-sm shrink-0">
                    <p className="text-sm font-black text-gray-400 italic uppercase">Noch keine Fahrten</p>
                    <p className="text-[10px] font-bold text-gray-300 uppercase mt-1">Startwert: {formatKm(initialKm)} km</p>
                  </div>
                ) : (
                  logs.map((log) => {
                      const diff = log.km - (log.startKm ?? log.km);
                      return (
                          <div key={log.id} onClick={() => handleEditClick(log)} className={`p-5 pl-6 rounded-3xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer active:scale-95 transition relative overflow-hidden shrink-0 ${log.type === 'fuel' ? 'bg-orange-50 border-orange-200' : 'bg-white'}`}>
                              <div className="absolute left-0 top-0 bottom-0 w-2.5" style={{ backgroundColor: log.type === 'fuel' ? '#f97316' : (log.userColor || "#ccc") }} />
                              <div className="flex flex-col text-left">
                                  <span className="font-black text-gray-800 text-lg leading-tight">
                                      {log.type === 'fuel' ? `GETANKT` : `${formatKm(log.startKm)} → ${formatKm(log.km)} km`}
                                  </span>
                                  {log.type !== 'fuel' && <span className="text-[10px] font-black text-green-600 uppercase tracking-tighter">+ {formatKm(diff)} km gefahren</span>}
                                  {log.type === 'fuel' && <span className="text-[10px] font-black text-orange-600 uppercase tracking-tighter">bei {formatKm(log.km)} km</span>}
                                  <span className="text-[10px] font-bold text-gray-400 uppercase mt-1">{log.userName}</span>
                              </div>
                              <div className="text-right flex flex-col items-end shrink-0">
                                  <span className="text-[11px] font-black text-gray-400 uppercase">{log.timestamp?.toDate().toLocaleDateString('de-DE')}</span>
                                  {log.type === 'fuel' && <span className="bg-orange-500 text-white text-[10px] px-2 py-1 rounded-lg mt-1 font-black">{log.fuelAmount}.-</span>}
                              </div>
                          </div>
                      );
                  })
                )}
            </div>
        </div>

        {/* MODAL TANKEN */}
        {isFuelModalOpen && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[110] p-4 animate-in fade-in duration-200">
                <div className="bg-white p-6 rounded-[2rem] w-full max-w-sm shadow-2xl">
                    <h2 className="text-xl font-black mb-4 text-center italic uppercase tracking-tighter text-black">Tanken</h2>
                    {!fuelSummary ? (
                        <form onSubmit={handleFuelSubmit} className="flex flex-col gap-4">
                            <input type="number" step="0.01" placeholder="Betrag in CHF" value={fuelPrice} onChange={(e) => setFuelPrice(e.target.value)} className="bg-gray-100 p-4 rounded-xl w-full font-black text-center text-2xl text-black border-2 border-orange-200 outline-none" required />
                            <button type="submit" className="bg-orange-500 text-white font-black py-4 rounded-2xl uppercase italic tracking-widest active:scale-95 transition text-sm">Berechnen & Abrechnen</button>
                            <button type="button" onClick={() => setIsFuelModalOpen(false)} className="text-gray-400 font-bold text-[10px] uppercase text-center mt-2">Abbrechen</button>
                        </form>
                    ) : (
                        <div className="flex flex-col gap-4 text-black">
                            <div className="bg-orange-50 p-5 rounded-2xl border border-orange-100">
                                <p className="text-[10px] font-black text-orange-600 uppercase mb-3 tracking-widest underline underline-offset-4">Abrechnung (Gerundet 0.05)</p>
                                {fuelSummary.map((s, i) => (
                                    <div key={i} className="flex justify-between mb-2 border-b border-orange-200 pb-2 last:border-0 last:mb-0 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }}></div>
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-700">{s.name}</span>
                                                <span className="text-[10px] text-gray-500 font-bold">{formatKm(s.dist)} km</span>
                                            </div>
                                        </div>
                                        <span className={`font-black ${s.debt > 0 ? 'text-green-700' : 'text-gray-400'}`}>
                                          {s.debt > 0 ? `${s.debt.toFixed(2)}.-` : 'Info'}
                                        </span>
                                    </div>
                                ))}
                            </div>
                            <button onClick={() => setIsFuelModalOpen(false)} className="bg-black text-white font-black py-4 rounded-2xl uppercase italic active:scale-95 transition text-sm">Fertig</button>
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* MODAL DETAIL / EDIT */}
        {isModalOpen && editingLog && (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
                <div className="bg-white p-6 rounded-[2rem] w-full max-w-sm text-black shadow-2xl overflow-hidden">
                    <h2 className="text-xl font-black mb-6 text-center italic uppercase tracking-tighter">
                        {editingLog.type === 'fuel' ? 'Tankbeleg' : 'Details'}
                    </h2>
                    <div className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] px-1 text-left">
                        <div className="bg-gray-100 p-3 rounded-xl flex justify-between items-center">
                            <span className="text-gray-400 font-bold text-xs uppercase tracking-widest">Ersteller</span>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: editingLog.type === 'fuel' ? '#f97316' : editingLog.userColor }}></div>
                                <span className="font-black text-sm">{editingLog.userName}</span>
                            </div>
                        </div>

                        {editingLog.type === 'fuel' ? (
                            <div className="flex flex-col gap-4">
                                <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center">
                                    <span className="text-[10px] font-bold text-orange-500 uppercase tracking-widest block mb-1">Betrag</span>
                                    <span className="text-3xl font-black text-orange-600 italic">{editingLog.fuelAmount?.toFixed(2)}.-</span>
                                </div>
                                {editingLog.fuelDetails && (
                                    <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
                                        <p className="text-[10px] font-black text-gray-400 uppercase mb-3 tracking-widest border-b pb-2 text-left text-black italic">Aufteilung</p>
                                        <div className="flex flex-col gap-3">
                                            {editingLog.fuelDetails.map((s, i) => (
                                                <div key={i} className="flex justify-between items-center">
                                                    <div className="flex items-center gap-2 text-left">
                                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }}></div>
                                                        <div className="flex flex-col">
                                                            <span className="font-bold text-gray-800 text-sm">{s.name}</span>
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{formatKm(s.dist)} km</span>
                                                        </div>
                                                    </div>
                                                    <span className={`font-black ${s.debt > 0 ? 'text-green-600' : 'text-gray-400'} text-sm`}>
                                                      {s.debt > 0 ? `${s.debt.toFixed(2)}.-` : '0.00'}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            editingLog.userId === user.uid ? (
                                <div className="flex flex-col gap-4">
                                    <div className="flex flex-col gap-1 text-left">
                                        <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase tracking-widest">Start KM</label>
                                        <div className="flex items-center gap-2">
                                            {/* NEU: Disabled style wenn am Limit */}
                                            <button type="button" onClick={decrementEditStartKm} disabled={Number(editStartKm) <= initialKm} className="bg-gray-100 h-10 w-10 rounded-xl flex items-center justify-center font-bold active:bg-gray-200 text-sm disabled:opacity-50 disabled:active:bg-gray-100 transition-opacity">-</button>
                                            <input type="number" step="1" value={editStartKm} onChange={(e) => updateEditStartKm(e.target.value)} className="bg-gray-50 h-10 flex-1 rounded-xl font-black text-center outline-none border border-gray-100 focus:border-green-500 transition no-spinner text-sm" required />
                                            <button type="button" onClick={() => updateEditStartKm(String(Number(editStartKm) + 1))} className="bg-gray-100 h-10 w-10 rounded-xl flex items-center justify-center font-bold active:bg-gray-200 text-sm">+</button>
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-1 text-left">
                                        <label className="text-[10px] font-bold text-gray-400 ml-2 uppercase tracking-widest">Ende KM</label>
                                        <div className="flex items-center gap-2">
                                            {/* NEU: Disabled style wenn am Limit */}
                                            <button type="button" onClick={decrementEditEndKm} disabled={Number(editEndKm) <= Number(editStartKm)} className="bg-gray-100 h-10 w-10 rounded-xl flex items-center justify-center font-bold active:bg-gray-200 text-sm disabled:opacity-50 disabled:active:bg-gray-100 transition-opacity">-</button>
                                            <input type="number" step="1" value={editEndKm} onChange={(e) => setEditEndKm(e.target.value)} className="bg-gray-50 h-10 flex-1 rounded-xl font-black text-center outline-none border border-gray-100 focus:border-green-500 transition no-spinner text-sm" required />
                                            <button type="button" onClick={() => setEditEndKm(String(Number(editEndKm) + 1))} className="bg-gray-100 h-10 w-10 rounded-xl flex items-center justify-center font-bold active:bg-gray-200 text-sm">+</button>
                                        </div>
                                    </div>
                                    <button onClick={handleUpdateLog} className="w-full bg-green-500 text-white font-black py-4 rounded-2xl uppercase italic shadow-lg active:scale-95 transition">Speichern</button>
                                </div>
                            ) : (
                                <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 text-center">
                                    <p className="text-2xl font-black italic">{formatKm(editingLog.startKm)} → {formatKm(editingLog.km)} km</p>
                                    <p className="text-xs font-bold text-green-500 uppercase mt-1">{formatKm((editingLog.km - (editingLog.startKm ?? editingLog.km)))} km gefahren</p>
                                </div>
                            )
                        )}

                        <div className="flex flex-col gap-2 mt-2">
                            <button onClick={() => setIsModalOpen(false)} className="w-full bg-gray-200 text-gray-700 font-bold py-4 rounded-2xl uppercase text-xs active:scale-95 transition">Schließen</button>
                            {editingLog.userId === user.uid && (
                                <button onClick={handleDeleteLog} className="w-full bg-red-50 text-red-500 font-bold py-3 rounded-xl uppercase text-[10px] mt-2 border border-red-100 active:bg-red-100">Löschen</button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}

        {/* TAB BAR */}
        <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-t border-gray-200 flex items-stretch z-50 px-6 pb-safe text-center">
          <div className="flex-1 flex flex-col items-center justify-center gap-1 active:scale-95 transition text-blue-600">
            <div className="w-6 h-6 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest">Fahrten</span>
          </div>
          <Link href={`/${resolvedParams.id}/calendar`} className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-40 transition text-gray-400">
            <div className="w-6 h-6 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Kalender</span>
          </Link>
          <Link href={`/${resolvedParams.id}/stats`} className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-40 transition text-gray-400">
            <div className="w-6 h-6 flex items-center justify-center">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest">Statistik</span>
          </Link>
        </nav>
      </div>
      
      <style jsx global>{`
        .no-spinner::-webkit-inner-spin-button, .no-spinner::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
        .no-spinner { -moz-appearance: textfield; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </main>
  );
}