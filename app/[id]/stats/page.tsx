"use client";

import { useEffect, useState, use } from "react";
import { collection, query, orderBy, onSnapshot, doc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { Link } from "next-view-transitions";
import { User } from "firebase/auth";
import { useUserProfiles } from "../../../lib/useUserProfiles";
import { useTheme } from "../../../lib/useTheme";
import { ensureUserProfile } from "../../../lib/userProfile";
import { DriveLog, formatKm, buildUidResolver } from "../../../lib/logs";
import * as XLSX from 'xlsx';

const MONTHS_DE = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember"
];

export default function StatsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [carName, setCarName] = useState("Lade...");
  const [logs, setLogs] = useState<DriveLog[]>([]);
  const userProfiles = useUserProfiles([
    user?.uid,
    ...logs.map((l) => l.userId),
    ...logs.flatMap((l) => l.fuelDetails?.map((d) => d.userId) ?? []),
  ]);
  
  // Date State for Filter
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [timeRange, setTimeRange] = useState<"1m" | "3m" | "6m" | "12m" | "all">("1m");
  useTheme();

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DriveLog | null>(null);
  const [tankBenchmark, setTankBenchmark] = useState<number>(75);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        window.location.href = "/";
      } else {
        setUser(u);
        ensureUserProfile(u).catch(console.error);

        try {
          const carDoc = await getDoc(doc(db, "cars", resolvedParams.id));
          if (carDoc.exists()) {
            setCarName(carDoc.data().name || "Auto");
            const members = carDoc.data().members || [];
            if (!members.includes(u.uid)) {
              alert("Du bist kein Mitglied dieses Teams.");
              window.location.href = "/";
            }
          } else {
            window.location.href = "/";
          }
        } catch (error) {
          console.error(error);
          window.location.href = "/";
        }
      }
    });
    return () => unsubscribeAuth();
  }, [resolvedParams.id]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "cars", resolvedParams.id, "logs"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DriveLog));
      setLogs(fetchedLogs);
    }, (error) => console.warn("Logs konnten nicht geladen werden:", error));
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
    const logDate = log.timestamp.toDate();
    
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
    // Normalize to the first of the month, otherwise setMonth jumps to the wrong month on the 29th-31st
    let start = new Date(today.getFullYear(), today.getMonth(), 1);
    if (timeRange === "3m") start = new Date(today.getFullYear(), today.getMonth() - 2, 1);
    else if (timeRange === "6m") start = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    else if (timeRange === "12m") start = new Date(today.getFullYear(), today.getMonth() - 11, 1);

    if (timeRange === "all") {
      return "Gesamte Historie (Alle Fahrten)";
    }
    
    const formatMonthYear = (d: Date) => `${MONTHS_DE[d.getMonth()]} ${d.getFullYear()}`;
    return `${formatMonthYear(start)} - ${formatMonthYear(today)}`;
  };

  const resolveUid = buildUidResolver(userProfiles, logs);

  const displayNameFor = (uid: string | undefined, fallback: string) =>
    (uid && userProfiles[uid]?.displayName) || fallback;

  const exportToExcel = () => {
    if (!filteredLogs || filteredLogs.length === 0) {
      alert("Keine Daten zum Exportieren in diesem Zeitraum.");
      return;
    }

    const exportData = filteredLogs.map(log => {
      const dateStr = log.timestamp ? log.timestamp.toDate().toLocaleString('de-CH', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' }) : "";
      
      if (log.type === 'fuel') {
        let detailsStr = "";
        if (log.fuelDetails) {
          detailsStr = log.fuelDetails.map(d => {
            const resolvedId = resolveUid(d.userId, d.name);
            const dName = resolvedId ? userProfiles[resolvedId]?.displayName : d.name;
            return `${dName || d.name}: ${formatKm(d.dist)}km (${d.debt.toFixed(2)}.-)`;
          }).join(" | ");
        }
        return {
          'Datum': dateStr,
          'Typ': 'Tankbeleg',
          'Fahrer / Ersteller': displayNameFor(log.userId, log.userName),
          'Start KM': '',
          'Ende KM': '',
          'Gefahrene KM': '',
          'Betrag (CHF)': log.fuelAmount?.toFixed(2) || '',
          'Aufteilung': detailsStr
        };
      } else {
        const dist = log.startKm && log.km ? log.km - log.startKm : 0;
        const uid = resolveUid(log.userId, log.userName);
        return {
          'Datum': dateStr,
          'Typ': 'Fahrt',
          'Fahrer / Ersteller': displayNameFor(uid, log.userName),
          'Start KM': log.startKm || '',
          'Ende KM': log.km || '',
          'Gefahrene KM': dist,
          'Betrag (CHF)': '',
          'Aufteilung': ''
        };
      }
    });

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Protokoll");
    
    worksheet['!cols'] = [
      {wch: 18}, // Datum
      {wch: 12}, // Typ
      {wch: 20}, // Fahrer
      {wch: 10}, // Start KM
      {wch: 10}, // Ende KM
      {wch: 15}, // Gefahrene KM
      {wch: 15}, // Betrag
      {wch: 60}  // Aufteilung
    ];

    const timeLabel = timeRange === "1m" ? "1_Monat" : timeRange === "3m" ? "3_Monate" : timeRange === "6m" ? "6_Monate" : timeRange === "12m" ? "12_Monate" : "Gesamt";
    XLSX.writeFile(workbook, `Fahrten_${carName.replace(/\s+/g, '_')}_${timeLabel}.xlsx`);
  };

  // Aggregated Stats Calculations
  let totalDistance = 0;
  let totalFuelCosts = 0;
  let drivesCount = 0;
  let fuelingsCount = 0;

  const distancePerUser: Record<string, { name: string; dist: number; color: string; count: number }> = {};
  const fuelDebtPerUser: Record<string, { name: string; debt: number; color: string; dist: number }> = {};

  filteredLogs.forEach(log => {
    if (log.type === "drive" || !log.type) {
      drivesCount++;
      const sKm = log.startKm ?? log.km;
      const dist = log.km - sKm;
      totalDistance += dist;

      const uid = resolveUid(log.userId, log.userName) || log.userId;
      if (!distancePerUser[uid]) {
        distancePerUser[uid] = {
          name: displayNameFor(uid, log.userName),
          dist: 0,
          color: userProfiles[uid]?.color || log.userColor || "#3b82f6",
          count: 0
        };
      }
      distancePerUser[uid].dist += dist;
      distancePerUser[uid].count += 1;
    } else if (log.type === "fuel") {
      fuelingsCount++;
      totalFuelCosts += log.fuelAmount || 0;

      if (log.fuelDetails) {
        log.fuelDetails.forEach(detail => {
          // Attribute to the Google account (uid). Legacy details without a
          // userId are matched by (case-insensitive) name; unresolvable rows
          // like "Lücke (nicht erfasst)" simply keep their name as the key.
          const matchedUid = resolveUid(detail.userId, detail.name);
          const key = matchedUid || detail.name;
          const resolvedColor = (matchedUid && userProfiles[matchedUid]?.color) || detail.color || "#9ca3af";

          if (!fuelDebtPerUser[key]) {
            fuelDebtPerUser[key] = {
              name: displayNameFor(matchedUid, detail.name),
              debt: 0,
              color: resolvedColor,
              dist: 0
            };
          }
          fuelDebtPerUser[key].debt += detail.debt;
          fuelDebtPerUser[key].dist += detail.dist;
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

  // Current Tank Calculations (independent of time filter)
  const currentTankDistancePerUser: Record<string, { name: string; dist: number; color: string }> = {};
  let currentTankTotalDistance = 0;

  for (const log of logs) {
    if (log.type === "fuel") {
      break; // Stop when we hit the most recent fuel event
    }
    if (log.type === "drive" || !log.type) {
      const sKm = log.startKm ?? log.km;
      const dist = log.km - sKm;
      currentTankTotalDistance += dist;

      const uid = resolveUid(log.userId, log.userName) || log.userId;
      if (!currentTankDistancePerUser[uid]) {
        currentTankDistancePerUser[uid] = {
          name: displayNameFor(uid, log.userName),
          dist: 0,
          color: userProfiles[uid]?.color || log.userColor || "#3b82f6"
        };
      }
      currentTankDistancePerUser[uid].dist += dist;
    }
  }

  const sortedCurrentTankList = Object.entries(currentTankDistancePerUser)
    .map(([userId, data]) => {
      const percentage = currentTankTotalDistance > 0 ? (data.dist / currentTankTotalDistance) * 100 : 0;
      const rawCost = (percentage / 100) * tankBenchmark;
      const estimatedCost = Math.round(rawCost * 20) / 20;
      return { userId, ...data, percentage, estimatedCost };
    })
    .sort((a, b) => b.dist - a.dist);

  // Immer die letzten 3 Jahre anbieten und bei älteren Protokollen bis zum
  // ältesten Eintrag erweitern (zuvor waren Logs vor diesem Fenster in der
  // Monatsansicht nicht erreichbar)
  const currentYear = new Date().getFullYear();
  const oldestLogYear = logs.reduce((min, l) => {
    const y = l.timestamp?.toDate().getFullYear();
    return y && y < min ? y : min;
  }, currentYear);
  const yearsAvailable: number[] = [];
  for (let y = currentYear; y >= Math.min(oldestLogYear, currentYear - 2); y--) {
    yearsAvailable.push(y);
  }

  if (!user) return null;

  return (
    <main className="w-full h-full flex flex-col items-center px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] bg-gray-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-y-auto relative transition-colors duration-200">
      <div style={{ viewTransitionName: "page-content" }} className="w-full max-w-md lg:max-w-2xl flex flex-col pb-4">
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <Link href={`/`} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 p-3 px-5 rounded-2xl shadow-sm dark:shadow-zinc-950/40 text-gray-700 dark:text-zinc-300 font-bold text-sm active:scale-90 transition uppercase">
            Zurück
          </Link>
          <h1 className="text-xl font-black italic uppercase text-gray-800 dark:text-zinc-100 tracking-tighter truncate mx-2">
            {carName}
          </h1>
          <button onClick={exportToExcel} className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 p-3 px-4 rounded-2xl active:scale-95 transition flex items-center justify-center gap-2 border border-green-200 dark:border-green-800/50 uppercase tracking-widest shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            <span className="hidden sm:inline font-black text-[10px]">Export</span>
          </button>
        </div>

        {/* TIME RANGE SELECTOR PILLS */}
        <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800/80 mb-4 shrink-0">
          {([
            { id: "1m", label: "1 Mon." },
            { id: "3m", label: "3 Mon." },
            { id: "6m", label: "6 Mon." },
            { id: "12m", label: "12 Mon." },
            { id: "all", label: "Gesamt" },
          ] as const).map((r) => (
            <button
              key={r.id}
              onClick={() => setTimeRange(r.id)}
              className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-tighter rounded-xl transition active:scale-95 ${
                timeRange === r.id
                  ? "bg-gray-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-md"
                  : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* MONTH SELECTOR OR RANGE BANNER */}
        {timeRange === "1m" ? (
          <div className="flex flex-col gap-3 mb-6 relative">
            <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800/80">
              <button onClick={handlePrevMonth} className="p-3 px-5 text-gray-700 dark:text-zinc-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-xl transition flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>

              <button 
                onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)} 
                className="font-black text-black dark:text-zinc-100 text-sm uppercase tracking-tight active:opacity-50 text-center flex-1 italic flex items-center justify-center gap-1.5"
              >
                <span>{MONTHS_DE[selectedDate.getMonth()]} {selectedDate.getFullYear()}</span>
                <svg className={`transition-transform duration-200 ${isMonthDropdownOpen ? 'rotate-180' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              <button onClick={handleNextMonth} className="p-3 px-5 text-gray-700 dark:text-zinc-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-xl transition flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
              </button>
            </div>

            {/* Month Dropdown Overlay */}
            {isMonthDropdownOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setIsMonthDropdownOpen(false)} />
                <div className="absolute top-14 left-0 right-0 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 rounded-2xl shadow-xl z-50 p-4 max-h-[300px] overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    {MONTHS_DE.map((m, idx) => (
                      <button 
                        key={m} 
                        onClick={() => handleSelectMonth(idx)} 
                        className={`py-2 px-1 text-[11px] font-black uppercase rounded-xl transition ${
                          selectedDate.getMonth() === idx 
                            ? 'bg-blue-600 text-white shadow-md' 
                            : 'bg-gray-50 dark:bg-zinc-950 text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {m.substring(0, 4)}
                      </button>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 dark:border-zinc-800/80 pt-3 flex justify-between items-center">
                    <span className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-widest">Jahr</span>
                    <div className="flex gap-2">
                      {yearsAvailable.map(y => (
                        <button 
                          key={y} 
                          onClick={() => handleSelectYear(y)} 
                          className={`px-3 py-1.5 text-xs font-black rounded-lg transition ${
                            selectedDate.getFullYear() === y 
                              ? 'bg-gray-800 dark:bg-zinc-100 text-white dark:text-zinc-950' 
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
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
          <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800/80 mb-6 text-center">
            <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest mb-1 block">Statistik-Zeitraum</span>
            <span className="font-black text-black dark:text-zinc-100 text-sm italic uppercase">{getRangeLabel()}</span>
          </div>
        )}



        {/* OVERVIEW METRIC CARDS */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800/80 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Distanz</span>
            <span className="text-2xl font-black italic tracking-tighter text-blue-600 dark:text-blue-400">{formatKm(totalDistance)} km</span>
            <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase mt-1">{drivesCount} Fahrten</span>
          </div>
          <div className="bg-white dark:bg-zinc-900 p-5 rounded-3xl border border-gray-100 dark:border-zinc-800/80 shadow-sm flex flex-col items-center justify-center text-center">
            <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">Tankkosten</span>
            <span className="text-2xl font-black italic tracking-tighter text-orange-600 dark:text-orange-400">{totalFuelCosts.toFixed(2)}.-</span>
            <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase mt-1">{fuelingsCount} Tankstopps</span>
          </div>
        </div>

        {/* CURRENT TANK VISUALIZATION PANEL */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800/80 mb-6 text-left">
          <div className="flex justify-between items-center mb-5 border-b border-gray-50 dark:border-zinc-800/50 pb-2">
            <h2 className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest italic">
              Aktueller Tank
            </h2>
            <button 
              onClick={() => {
                const val = window.prompt("Neuen Richtwert eingeben (z.B. 75):", tankBenchmark.toString());
                if (val !== null) {
                  const parsed = parseFloat(val.replace(',', '.'));
                  if (!isNaN(parsed) && parsed > 0) {
                    setTankBenchmark(parsed);
                  }
                }
              }}
              className="text-[10px] font-bold text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 px-2 py-0.5 rounded-md active:scale-95 transition"
            >
              Richtwert: {tankBenchmark}.-
            </button>
          </div>
          
          {sortedCurrentTankList.length === 0 ? (
            <p className="text-center text-sm font-black text-gray-300 dark:text-zinc-600 uppercase py-4 italic">
              Noch keine Fahrten seit dem letzten Tanken
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {sortedCurrentTankList.map((item) => (
                <div key={item.userId} className="flex flex-col">
                  <div className="flex justify-between items-center text-sm font-black text-gray-800 dark:text-zinc-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-black italic text-gray-600 dark:text-zinc-400">
                        ≈ {item.estimatedCost.toFixed(2)}.-
                      </span>
                      <span className="text-[10px] font-black text-orange-600 dark:text-orange-400 mt-0.5">
                        {formatKm(item.dist)} km <span className="font-bold opacity-80">({item.percentage.toFixed(0)}%)</span>
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-zinc-950 h-3.5 rounded-full mt-2 overflow-hidden shadow-inner border border-gray-50 dark:border-zinc-800/20">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out" 
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* DISTANCE VISUALIZATION PANELS */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800/80 mb-6 text-left">
          <h2 className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-5 italic border-b border-gray-50 dark:border-zinc-800/50 pb-2">
            Fahrstrecke nach Person
          </h2>
          {sortedDistanceList.length === 0 ? (
            <p className="text-center text-sm font-black text-gray-300 dark:text-zinc-600 uppercase py-4 italic">
              Keine Fahrten in diesem Monat
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {sortedDistanceList.map((item) => (
                <div key={item.userId} className="flex flex-col">
                  <div className="flex justify-between items-center text-sm font-black text-gray-800 dark:text-zinc-200">
                    <div className="flex items-center gap-2">
                      <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-black italic text-gray-600 dark:text-zinc-400">
                      {formatKm(item.dist)} km <span className="text-xs font-bold text-gray-400 dark:text-zinc-500">({item.percentage.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 dark:bg-zinc-950 h-3.5 rounded-full mt-2 overflow-hidden shadow-inner border border-gray-50 dark:border-zinc-800/20">
                    <div 
                      className="h-full rounded-full transition-all duration-700 ease-out" 
                      style={{ width: `${item.percentage}%`, backgroundColor: item.color }} 
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase tracking-tight">
                    <span>{item.count} Fahrt{item.count > 1 ? 'en' : ''}</span>
                    <span>Schnitt: {formatKm(Math.round(item.dist / item.count))} km</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* FUEL DEBT VISUALIZATION PANELS */}
        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2.5rem] shadow-sm border border-gray-100 dark:border-zinc-800/80 mb-6 text-left">
          <h2 className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-5 italic border-b border-gray-50 dark:border-zinc-800/50 pb-2">
            Abrechnung & Schulden
          </h2>
          {sortedFuelList.length === 0 ? (
            <p className="text-center text-sm font-black text-gray-300 dark:text-zinc-600 uppercase py-4 italic">
              Keine Tankabrechnungen in diesem Monat
            </p>
          ) : (
            <div className="flex flex-col gap-4">

              <div className="flex flex-col gap-3">
                {sortedFuelList.map((item) => (
                  <div key={item.userId} className="flex justify-between items-center bg-gray-50 dark:bg-zinc-950/60 p-3.5 rounded-2xl border border-gray-100 dark:border-zinc-800/40">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <div className="flex flex-col">
                        <span className="font-black text-sm text-gray-800 dark:text-zinc-200">{item.name}</span>
                        <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase">{formatKm(item.dist)} km abgerechnet</span>
                      </div>
                    </div>
                    <span className="font-black text-base text-green-600 dark:text-green-400 italic">
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
          <h2 className="text-xs font-black text-gray-400 dark:text-zinc-500 uppercase tracking-widest ml-4 mb-4 italic">
            {timeRange === "1m" ? `Protokolle in ${MONTHS_DE[selectedDate.getMonth()]}` : "Protokolle im Zeitraum"}
          </h2>
          <div className="flex flex-col gap-3">
            {filteredLogs.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 p-6 rounded-3xl border border-gray-100 dark:border-zinc-800/80 text-center shadow-sm">
                <p className="text-sm font-black text-gray-300 dark:text-zinc-600 italic uppercase">Keine Protokolle vorhanden</p>
              </div>
            ) : (
              filteredLogs.map((log) => {
                const logDate = log.timestamp!.toDate();
                const diff = log.km - (log.startKm ?? log.km);
                return (
                  <div 
                    key={log.id} 
                    onClick={() => {
                      setSelectedLog(log);
                      setIsDetailModalOpen(true);
                    }}
                    className={`p-4 pl-5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800/80 flex justify-between items-center relative overflow-hidden transition cursor-pointer active:scale-98 hover:opacity-95 dark:hover:opacity-90 ${
                      log.type === 'fuel' 
                        ? 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/40 text-zinc-900 dark:text-zinc-100 hover:bg-orange-100/45 dark:hover:bg-orange-900/30' 
                        : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 hover:bg-gray-50/80 dark:hover:bg-zinc-800/50'
                    }`}
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-2" style={{ backgroundColor: log.type === 'fuel' ? '#f97316' : (userProfiles[log.userId]?.color || log.userColor || "#ccc") }} />
                    <div className="flex flex-col text-left">
                      <span className="font-black text-gray-800 dark:text-zinc-200 text-base leading-tight">
                        {log.type === 'fuel' ? `GETANKT` : `${formatKm(log.startKm)} → ${formatKm(log.km)} km`}
                      </span>
                      {log.type !== 'fuel' && <span className="text-[9px] font-black text-green-600 dark:text-green-400 uppercase tracking-tight">+ {formatKm(diff)} km gefahren</span>}
                      {log.type === 'fuel' && <span className="text-[9px] font-black text-orange-600 dark:text-orange-400 uppercase tracking-tight">bei {formatKm(log.km)} km</span>}
                      <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase mt-0.5">{userProfiles[log.userId]?.displayName || log.userName}</span>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-black text-gray-400 dark:text-zinc-500">
                        {logDate.toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr
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

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; }
      `}</style>

      {/* DETAIL MODAL (READ-ONLY) */}
      {isDetailModalOpen && selectedLog && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] w-full max-w-sm text-zinc-900 dark:text-zinc-100 border border-gray-100 dark:border-zinc-800 shadow-2xl overflow-hidden">
            <h2 className="text-xl font-black mb-6 text-center italic uppercase tracking-tighter text-black dark:text-white">
              {selectedLog.type === 'fuel' ? 'Tankbeleg' : 'Details'}
            </h2>
            <div className="flex flex-col gap-4 overflow-y-auto max-h-[70vh] px-1 text-left text-zinc-900 dark:text-zinc-150">
              <div className="bg-gray-100 dark:bg-zinc-800/40 p-3 rounded-xl flex flex-col gap-2 border border-gray-100 dark:border-zinc-800/80">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 dark:text-zinc-500 font-bold text-xs uppercase tracking-widest">Ersteller</span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: userProfiles[selectedLog.userId]?.color || selectedLog.userColor || "#ccc" }}></div>
                    <span className="font-black text-sm text-black dark:text-zinc-200">{userProfiles[selectedLog.userId]?.displayName || selectedLog.userName}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center border-t border-gray-200 dark:border-zinc-700/50 pt-2">
                  <span className="text-gray-400 dark:text-zinc-500 font-bold text-xs uppercase tracking-widest">Zeitpunkt</span>
                  <span className="font-black text-sm text-gray-800 dark:text-zinc-200">{selectedLog.timestamp?.toDate().toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })} Uhr</span>
                </div>
              </div>

              {selectedLog.type === 'fuel' ? (
                <div className="flex flex-col gap-4">
                  <div className="bg-orange-50 dark:bg-orange-950/20 p-4 rounded-2xl border border-orange-100 dark:border-orange-900/30 text-center">
                    <span className="text-[10px] font-bold text-orange-500 dark:text-orange-400 uppercase tracking-widest block mb-1">Betrag</span>
                    <span className="text-3xl font-black text-orange-600 dark:text-orange-400 italic">{selectedLog.fuelAmount?.toFixed(2)}.-</span>
                  </div>
                  {selectedLog.fuelDetails && (
                    <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 rounded-2xl p-4 shadow-sm">
                      <p className="text-[10px] font-black text-gray-400 dark:text-zinc-500 uppercase mb-3 tracking-widest border-b border-gray-100 dark:border-zinc-800 pb-2 text-left italic">Aufteilung</p>
                      <div className="flex flex-col gap-3">
                        {selectedLog.fuelDetails.map((s, i) => {
                          const resolvedId = resolveUid(s.userId, s.name);
                          const matchedProfile = resolvedId ? userProfiles[resolvedId] : undefined;
                          const displayColor = matchedProfile?.color || s.color || "#ccc";
                          const displayName = matchedProfile?.displayName || s.name;
                          return (
                            <div key={i} className="flex justify-between items-center bg-gray-50/50 dark:bg-zinc-950/30 p-2.5 rounded-xl border border-gray-100/50 dark:border-zinc-800/30">
                              <div className="flex items-center gap-2 text-left">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: displayColor }}></div>
                                <div className="flex flex-col">
                                  <span className="font-bold text-gray-800 dark:text-zinc-300 text-xs">{displayName}</span>
                                  <span className="text-[9px] font-bold text-gray-400 dark:text-zinc-500 uppercase">{formatKm(s.dist)} km</span>
                                </div>
                              </div>
                              <span className={`font-black ${s.debt > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-zinc-500'} text-xs`}>
                                {s.debt > 0 ? `${s.debt.toFixed(2)}.-` : '0.00'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-zinc-800/40 p-5 rounded-2xl border border-gray-100 dark:border-zinc-800/80 text-center">
                  <p className="text-2xl font-black italic text-zinc-900 dark:text-white">{formatKm(selectedLog.startKm)} → {formatKm(selectedLog.km)} km</p>
                  <p className="text-xs font-bold text-green-500 dark:text-green-400 uppercase mt-1">{formatKm((selectedLog.km - (selectedLog.startKm ?? selectedLog.km)))} km gefahren</p>
                </div>
              )}

              <div className="flex flex-col gap-2 mt-2">
                <button onClick={() => setIsDetailModalOpen(false)} className="w-full bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-bold py-4 rounded-2xl uppercase text-xs active:scale-95 hover:bg-gray-300 dark:hover:bg-zinc-700 transition">Schließen</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
