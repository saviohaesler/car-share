"use client";

import { useEffect, useState, use } from "react";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
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

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni", 
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

const formatKm = (km: number | string | undefined) => {
  if (km === undefined || km === null) return '?';
  return km.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'");
};

export default function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [carName, setCarName] = useState("Lade...");
  const [initialKm, setInitialKm] = useState<number>(0);
  const [logs, setLogs] = useState<DriveLog[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, { displayName: string, color: string }>>({});
  
  // Date State for Filter
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<"1m" | "3m" | "6m" | "12m" | "all">("1m");

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        window.location.href = "/";
      } else {
        setUser(u);
        const carDoc = await getDoc(doc(db, "cars", resolvedParams.id));
        if (carDoc.exists()) {
          setCarName(carDoc.data().name || "Auto");
          setInitialKm(carDoc.data().initialKm || 0);
          const members = carDoc.data().members || [];
          if (!members.includes(u.uid)) {
            alert("Du bist kein Mitglied dieses Teams.");
            window.location.href = "/";
          }
        } else {
          window.location.href = "/";
        }
      }
    });
    return () => unsubscribeAuth();
  }, [resolvedParams.id]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      const profiles: any = {};
      snapshot.docs.forEach(doc => { profiles[doc.id] = doc.data(); });
      setUserProfiles(profiles);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "cars", resolvedParams.id, "logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DriveLog));
      setLogs(fetchedLogs);
    });
    return () => unsubscribe();
  }, [resolvedParams.id, user]);

  // Navigate Months
  const handlePrevMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() - 1);
    setSelectedDate(newDate);
  };

  const handleNextMonth = () => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(newDate.getMonth() + 1);
    setSelectedDate(newDate);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const newDate = new Date(selectedDate);
    newDate.setMonth(monthIndex);
    setSelectedDate(newDate);
    setIsMonthDropdownOpen(false);
  };

  const handleSelectYear = (year: number) => {
    const newDate = new Date(selectedDate);
    newDate.setFullYear(year);
    setSelectedDate(newDate);
  };

  // Filter logs for the selected time range
  const filteredLogs = logs.filter(log => {
    if (!log.timestamp) return false;
    const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
    
    if (timeRange === "1m") {
      return logDate.getFullYear() === selectedDate.getFullYear() && 
             logDate.getMonth() === selectedDate.getMonth();
    }
    
    if (timeRange === "all") return true;

    const today = new Date();
    // Calculate months difference
    const diffMonths = (today.getFullYear() - logDate.getFullYear()) * 12 + (today.getMonth() - logDate.getMonth());
    
    if (timeRange === "3m") return diffMonths >= 0 && diffMonths < 3;
    if (timeRange === "6m") return diffMonths >= 0 && diffMonths < 6;
    if (timeRange === "12m") return diffMonths >= 0 && diffMonths < 12;
    
    return false;
  });

  const getRangeLabel = () => {
    const today = new Date();
    const start = new Date(today);
    if (timeRange === "3m") start.setMonth(today.getMonth() - 2);
    else if (timeRange === "6m") start.setMonth(today.getMonth() - 5);
    else if (timeRange === "12m") start.setMonth(today.getMonth() - 11);
    
    if (timeRange === "all") {
      return "Gesamte Historie (Alle Fahrten)";
    }
    
    const formatMonthYear = (d: Date) => `${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
    return `${formatMonthYear(start)} - ${formatMonthYear(today)}`;
  };

  // Aggregated Stats Calculations
  let totalDistance = 0;
  let totalFuelCosts = 0;
  let drivesCount = 0;
  let fuelingsCount = 0;

  const distancePerUser: Record<string, { name: string; dist: number; color: string; count: number }> = {};
  const fuelDebtPerUser: Record<string, { name: string; debt: number; color: string; dist: number }> = {};

  // Initialize members in stats so everyone in the car shows up, even with 0 km
  Object.keys(userProfiles).forEach(uid => {
    // Only add if they are listed as a member in userProfiles (or we can populate dynamically from logs)
    // To make it simple, we initialize from active drive logs & profiles
  });

  filteredLogs.forEach(log => {
    const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
    
    if (log.type === "drive" || !log.type) {
      drivesCount++;
      const sKm = log.startKm ?? log.km;
      const dist = log.km - sKm;
      totalDistance += dist;

      if (!distancePerUser[log.userId]) {
        distancePerUser[log.userId] = {
          name: log.userName,
          dist: 0,
          color: log.userColor || "#3b82f6",
          count: 0
        };
      }
      distancePerUser[log.userId].dist += dist;
      distancePerUser[log.userId].count += 1;
    } else if (log.type === "fuel") {
      fuelingsCount++;
      totalFuelCosts += log.fuelAmount || 0;

      if (log.fuelDetails) {
        log.fuelDetails.forEach(detail => {
          // Find matching user profile key to get color/ID if possible, or use display name
          const matchedUid = Object.keys(userProfiles).find(
            uid => userProfiles[uid].displayName === detail.name
          ) || detail.name;

          if (!fuelDebtPerUser[matchedUid]) {
            fuelDebtPerUser[matchedUid] = {
              name: detail.name,
              debt: 0,
              color: detail.color || "#9ca3af",
              dist: 0
            };
          }
          fuelDebtPerUser[matchedUid].debt += detail.debt;
          fuelDebtPerUser[matchedUid].dist += detail.dist;
        });
      }
    }
  });

  // Calculate percentages and sort distance lists
  const sortedDistanceList = Object.entries(distancePerUser)
    .map(([userId, data]) => {
      const percentage = totalDistance > 0 ? (data.dist / totalDistance) * 100 : 0;
      return { userId, ...data, percentage };
    })
    .sort((a, b) => b.dist - a.dist);

  const sortedFuelList = Object.entries(fuelDebtPerUser)
    .map(([userId, data]) => ({ userId, ...data }))
    .sort((a, b) => b.debt - a.debt);

  const yearsAvailable = Array.from(
    new Set([new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2])
  ).sort((a, b) => b - a);

  if (!user) return null;

  return (
    <main className="w-full h-[100dvh] flex flex-col items-center p-4 bg-gray-50 text-black overflow-y-auto">
      <div className="w-full max-w-md flex flex-col pb-28">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <Link href={`/`} className="bg-white p-3 px-5 rounded-2xl shadow-sm text-gray-700 font-bold text-sm active:scale-90 transition uppercase">
            Zurück
          </Link>
          <h1 className="text-xl font-black italic uppercase text-gray-800 tracking-tighter">
            {carName}
          </h1>
        </div>

        {/* TIME RANGE SELECTOR PILLS */}
        <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 mb-4 shrink-0">
          {[
            { id: "1m", label: "1 Mon." },
            { id: "3m", label: "3 Mon." },
            { id: "6m", label: "6 Mon." },
            { id: "12m", label: "12 Mon." },
            { id: "all", label: "Gesamt" },
          ].map((r) => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id as any)}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-tighter rounded-xl transition active:scale-95 ${
                timeRange === r.id
                  ? "bg-gray-900 text-white shadow-md"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* MONTH SELECTOR OR RANGE BANNER */}
        {timeRange === "1m" ? (
          <div className="flex flex-col gap-3 mb-6 relative">
            <div className="flex justify-between items-center bg-white p-1.5 rounded-2xl shadow-sm border border-gray-100">
              <button onClick={handlePrevMonth} className="p-3 px-5 text-gray-700 active:bg-gray-100 rounded-xl transition flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>

              <button 
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)} 
                className="font-black text-black text-sm uppercase tracking-tight active:opacity-50 text-center flex-1 italic flex items-center justify-center gap-1.5"
              >
                <span>{MONTHS_DE[selectedDate.getMonth()]} {selectedDate.getFullYear()}</span>
                <svg className={`transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <button onClick={handleNextMonth} className="p-3 px-5 text-gray-700 active:bg-gray-100 rounded-xl transition flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            {/* Month Dropdown Overlay */}
            {isMonthDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMonthDropdownOpen(false)} />
                <div className="absolute top-14 left-0 right-0 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 p-4 max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {MONTHS_DE.map((m, idx) => (
                      <button 
                        key={m} 
                        onClick={() => handleSelectMonth(idx)} 
                        className={`py-2 px-1 text-[11px] font-black uppercase rounded-xl transition ${
                          selectedDate.getMonth() === idx 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        {m.substring(0, 4)}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Jahr</span>
                    <div className="flex gap-2">
                      {yearsAvailable.map(y => (
                        <button 
                          key={y} 
                          onClick={() => handleSelectYear(y)} 
                          className={`px-3 py-1.5 text-xs font-black rounded-lg transition ${
                            selectedDate.getFullYear() === y 
                              ? 'bg-gray-800 text-white' 
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 text-center">
            <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 block">Statistik-Zeitraum</span>
            <span className="font-black text-black text-sm italic uppercase">{getRangeLabel()}</span>
          </div>
        )}

        {/* OVERVIEW METRIC CARDS */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Distanz</span>
            <span className="text-2xl font-black italic tracking-tighter text-blue-600">{formatKm(totalDistance)} km</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase mt-1">{drivesCount} Fahrten</span>
          </div>
          <div className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tankkosten</span>
            <span className="text-2xl font-black italic tracking-tighter text-orange-600">{totalFuelCosts.toFixed(2)}.-</span>
            <span className="text-[9px] font-bold text-gray-400 uppercase mt-1">{fuelingsCount} Tankstopps</span>
          </div>
        </div>

        {/* DISTANCE VISUALIZATION PANELS */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 mb-6 text-left">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 italic border-b border-gray-50 pb-2">
            Fahrstrecke nach Person
          </h2>
          {sortedDistanceList.length === 0 ? (
            <p className="text-center text-sm font-black text-gray-300 uppercase py-4 italic">
              Keine Fahrten in diesem Monat
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {sortedDistanceList.map((item) => (
                <div key={item.userId} className="flex flex-col">
                  <div className="flex justify-between items-center text-sm font-black text-gray-800">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-black italic text-gray-600">
                      {formatKm(item.dist)} km <span className="text-xs font-bold text-gray-400">({item.percentage.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 h-3.5 rounded-full mt-2 overflow-hidden shadow-inner border border-gray-50">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out" 
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }} 
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[9px] font-bold text-gray-400 uppercase tracking-tight">
                    <span>{item.count} Fahrt{item.count > 1 ? 'en' : ''}</span>
                    <span>Schnitt: {formatKm(Math.round(item.dist / item.count))} km</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FUEL DEBT VISUALIZATION PANELS */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border border-gray-100 mb-6 text-left">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-5 italic border-b border-gray-50 pb-2">
            Abrechnung & Schulden
          </h2>
          {sortedFuelList.length === 0 ? (
            <p className="text-center text-sm font-black text-gray-300 uppercase py-4 italic">
              Keine Tankabrechnungen in diesem Monat
            </p>
          ) : (
            <div className="flex flex-col gap-4">

              <div className="flex flex-col gap-3">
                {sortedFuelList.map((item) => (
                  <div key={item.userId} className="flex justify-between items-center bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-gray-800">{item.name}</span>
                        <span className="text-[9px] font-bold text-gray-400 uppercase">{formatKm(item.dist)} km abgerechnet</span>
                      </div>
                    </div>
                    <span className="font-black text-base text-green-600 italic">
                      {item.debt.toFixed(2)}.-
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* MONTH DETAILED FEED / HISTORY */}
        <div className="flex flex-col text-left">
          <h2 className="text-xs font-black text-gray-400 uppercase tracking-widest ml-4 mb-4 italic">
            Protokolle in {MONTHS_DE[selectedDate.getMonth()]}
          </h2>
          <div className="flex flex-col gap-3">
            {filteredLogs.length === 0 ? (
              <div className="bg-white p-6 rounded-3xl border border-gray-100 text-center shadow-sm">
                <p className="text-sm font-black text-gray-300 italic uppercase">Keine Protokolle vorhanden</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const logDate = log.timestamp.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                const diff = log.km - (log.startKm ?? log.km);
                return (
                  <div 
                    key={log.id} 
                    className={`p-4 pl-5 rounded-2xl shadow-sm border border-gray-100 flex justify-between items-center relative overflow-hidden transition ${
                      log.type === 'fuel' ? 'bg-orange-50/50 border-orange-200' : 'bg-white'
                    }`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: log.type === 'fuel' ? '#f97316' : (log.userColor || "#ccc") }} />
                    <div className="flex flex-col text-left">
                      <span className="font-black text-gray-800 text-base leading-tight">
                        {log.type === 'fuel' ? `GETANKT` : `${formatKm(log.startKm)} → ${formatKm(log.km)} km`}
                      </span>
                      {log.type !== 'fuel' && <span className="text-[9px] font-black text-green-600 uppercase tracking-tight">+ {formatKm(diff)} km gefahren</span>}
                      {log.type === 'fuel' && <span className="text-[9px] font-black text-orange-600 uppercase tracking-tight">bei {formatKm(log.km)} km</span>}
                      <span className="text-[9px] font-bold text-gray-400 uppercase mt-0.5">{log.userName}</span>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-black text-gray-400 uppercase">
                        {logDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </span>
                      {log.type === 'fuel' && (
                        <span className="bg-orange-500 text-white text-[9px] px-2 py-0.5 rounded-md mt-1 font-black">
                          {log.fuelAmount}.-
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* TAB BAR */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-xl border-t border-gray-200 flex items-stretch z-50 px-6 pb-safe text-center">
        <Link href={`/${resolvedParams.id}/log`} className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-40 transition text-gray-400">
          <div className="w-6 h-6 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Fahrten</span>
        </Link>
        <Link href={`/${resolvedParams.id}/calendar`} className="flex-1 flex flex-col items-center justify-center gap-1 active:opacity-40 transition text-gray-400">
          <div className="w-6 h-6 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest">Kalender</span>
        </Link>
        <div className="flex-1 flex flex-col items-center justify-center gap-1 text-blue-600">
          <div className="w-6 h-6 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </div>
          <span className="text-[10px] font-black uppercase tracking-widest">Statistik</span>
        </div>
      </nav>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
      `}</style>
    </main>
  );
}
