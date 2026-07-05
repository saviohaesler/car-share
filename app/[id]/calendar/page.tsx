"use client";

import { useEffect, useState, use, useMemo, useRef } from "react";
import { format } from "date-fns";
import { collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, getDoc } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { Link } from "next-view-transitions";
import { User } from "firebase/auth";
import { useUserProfiles } from "../../../lib/useUserProfiles";
import { useTheme } from "../../../lib/useTheme";

// FULLCALENDAR IMPORTS
import FullCalendar from '@fullcalendar/react';
import type { DateSelectArg, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import deLocale from '@fullcalendar/core/locales/de';

interface Reservation {
  id?: string;
  title: string;
  userName: string;
  start: Date;
  end: Date;
  userId: string;
  allDay?: boolean;
}

export default function CalendarPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const calendarRef = useRef<FullCalendar>(null);

  const [user, setUser] = useState<User | null>(null);
  const [carName, setCarName] = useState("Lade...");
  const [events, setEvents] = useState<Reservation[]>([]);
  const userProfiles = useUserProfiles([user?.uid, ...events.map((e) => e.userId)]);
  useTheme();

  // Toolbar & View States
  const [calendarTitle, setCalendarTitle] = useState("");
  const [currentView, setCurrentView] = useState("timeGridThreeDay");

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Reservation | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  const [isAllDay, setIsAllDay] = useState(false);

  // Start date for the 3-day view ("Yesterday")
  const initialDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d;
  }, []);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        window.location.href = "/";
      } else {
        setUser(u);
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
    const q = query(collection(db, "cars", resolvedParams.id, "reservations"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // Skip individual broken documents (missing start/end)
      // instead of crashing the entire listener
      const loadedEvents = snapshot.docs.flatMap(doc => {
        const data = doc.data();
        if (typeof data.start?.toDate !== "function" || typeof data.end?.toDate !== "function") {
          console.warn("Reservierung mit ungültigen Daten übersprungen:", doc.id);
          return [];
        }
        return [{
          id: doc.id,
          title: data.title || "Fahrt",
          userName: data.userName || "Unbekannt",
          start: data.start.toDate(),
          end: data.end.toDate(),
          userId: data.userId,
          allDay: data.allDay || false
        }];
      });
      setEvents(loadedEvents);
    }, (error) => console.warn("Reservierungen konnten nicht geladen werden:", error));
    return () => unsubscribe();
  }, [resolvedParams.id, user]);

  // FullCalendar Events Mapping
  const mappedEvents = events.map(e => ({
    id: e.id,
    title: e.title,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    backgroundColor: userProfiles[e.userId]?.color || '#3b82f6',
    extendedProps: {
      userId: e.userId,
      userName: e.userName
    }
  }));

  // Custom Toolbar Logic
  const goToBack = () => calendarRef.current?.getApi().prev();
  const goToNext = () => calendarRef.current?.getApi().next();
  const goToToday = () => {
    const api = calendarRef.current?.getApi();
    if (currentView === 'timeGridThreeDay') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      api?.gotoDate(yesterday);
    } else {
      api?.today();
    }
  };

  const changeView = (viewName: string) => {
    calendarRef.current?.getApi().changeView(viewName);
    setCurrentView(viewName);
  };

  // FullCalendar Handler
  const handleSelectSlot = (selectInfo: DateSelectArg) => {
    if (!user) return;
    
    // Stop propagation to prevent immediate closure or double-trigger issues
    if (selectInfo.jsEvent) {
      selectInfo.jsEvent.stopPropagation();
      selectInfo.jsEvent.preventDefault();
    }
    
    const start = selectInfo.start;
    const end = selectInfo.end;
    
    setEditingEvent(null);
    setNewTitle("");
    setStartDate(format(start, "yyyy-MM-dd"));
    setStartTime(format(start, "HH:mm"));
    setIsAllDay(selectInfo.allDay);
    
    if (selectInfo.allDay) {
      const adjustedEnd = new Date(end.getTime() - 1000);
      setEndDate(format(adjustedEnd, "yyyy-MM-dd"));
      setEndTime(format(adjustedEnd, "HH:mm"));
    } else if (start.getTime() === end.getTime() || (end.getTime() - start.getTime() < 60000)) {
      const defaultEnd = new Date(start.getTime() + 60 * 60 * 1000);
      setEndDate(format(defaultEnd, "yyyy-MM-dd"));
      setEndTime(format(defaultEnd, "HH:mm"));
    } else {
      setEndDate(format(end, "yyyy-MM-dd"));
      setEndTime(format(end, "HH:mm"));
    }
    setIsModalOpen(true);
    
    // Unselect asynchronously to avoid conflicts during the event rendering cycle
    setTimeout(() => {
      calendarRef.current?.getApi().unselect();
    }, 50);
  };

  const handleSelectEvent = (clickInfo: EventClickArg) => {
    const ev = clickInfo.event;
    if (!ev.start) return;
    setEditingEvent({
      id: ev.id,
      title: ev.title,
      start: ev.start,
      end: ev.end ?? ev.start,
      userId: ev.extendedProps.userId,
      userName: ev.extendedProps.userName,
      allDay: ev.allDay
    });
    setNewTitle(ev.title);
    setIsAllDay(ev.allDay);
    setStartDate(format(ev.start, "yyyy-MM-dd"));
    setStartTime(format(ev.start, "HH:mm"));
    
    if (ev.end) {
       const endDate = ev.allDay ? new Date(ev.end.getTime() - 1000) : ev.end;
       setEndDate(format(endDate, "yyyy-MM-dd"));
       setEndTime(format(endDate, "HH:mm"));
    } else {
       setEndDate(format(ev.start, "yyyy-MM-dd"));
       setEndTime(format(ev.start, "HH:mm"));
    }

    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || (editingEvent?.userId && editingEvent.userId !== user.uid)) return;
    let start = new Date(`${startDate}T${startTime}`);
    let end = new Date(`${endDate}T${endTime}`);

    if (isAllDay) {
        if (endDate < startDate) { alert("Das Enddatum darf nicht vor dem Beginn liegen!"); return; }
        // Use local midnight ("yyyy-MM-dd" alone would be parsed as UTC)
        start = new Date(`${startDate}T00:00`);
        end = new Date(`${endDate}T00:00`);
        end.setDate(end.getDate() + 1);
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        alert("Bitte gültiges Datum und Uhrzeit angeben!");
        return;
    }
    if (!isAllDay && end <= start) { alert("Ende muss nach Beginn liegen!"); return; }

    const currentName = userProfiles[user.uid]?.displayName || user.displayName || "Unbekannt";

    try {
      if (editingEvent?.id) {
        await updateDoc(doc(db, "cars", resolvedParams.id, "reservations", editingEvent.id), { 
            title: newTitle || "Fahrt", start, end, allDay: isAllDay 
        });
      } else {
        await addDoc(collection(db, "cars", resolvedParams.id, "reservations"), { 
            title: newTitle || "Fahrt", userName: currentName, start, end, userId: user.uid, allDay: isAllDay 
        });
      }
      setIsModalOpen(false);
    } catch (error) { console.error(error); }
  };

  const handleDelete = async () => {
    if (!editingEvent?.id || !user || editingEvent.userId !== user.uid) return;
    if (window.confirm("Reservierung löschen?")) {
      await deleteDoc(doc(db, "cars", resolvedParams.id, "reservations", editingEvent.id));
      setIsModalOpen(false);
    }
  };

  const isOwner = editingEvent ? editingEvent.userId === user?.uid : true;

  if (!user) return null;

  return (
    <main className="w-full h-full flex flex-col items-center px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] bg-gray-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden relative transition-colors duration-200">
      <style>{`
        .fc { font-family: inherit; }
        .fc-theme-standard th { border: none !important; padding: 8px 0; }
        
        /* FIX: Removes the border around the calendar grid to match log style */
        .fc-scrollgrid { border-radius: 12px; overflow: hidden; border: none !important; }
        
        .fc-timegrid-now-indicator-line { border-color: #ef4444; border-width: 2px; }
        .fc-timegrid-now-indicator-arrow { border-color: #ef4444; border-width: 5px; margin-top: -5px; }
        
        /* Event Styling TimeGrid */
        .fc-timegrid-event {
          border-radius: 6px !important;
          border: none !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.1);
          overflow: visible !important;
          z-index: 10 !important;
        }

        .fc-v-event .fc-event-main-frame {
           overflow: visible !important;
        }
        
        /* Event Styling MonthView & AllDay (Colored blocks again, so multi-day events are continuous) */
        .fc-daygrid-event {
          border-radius: 4px !important;
          border: none !important;
          padding: 2px;
          margin-bottom: 2px !important;
        }
        .fc-daygrid-event:hover {
          filter: brightness(0.9);
        }

        .fc-col-header-cell-cushion, 
        .fc-timegrid-slot-label-cushion {
          color: #000000 !important;
          font-weight: 900 !important;
          text-transform: uppercase;
        }

        .fc-timegrid-axis-cushion {
          font-size: 10px;
          text-transform: uppercase;
        }
        
        input[type="date"], input[type="time"], input[type="text"] {
          color: #000000 !important;
          -webkit-text-fill-color: #000000 !important;
          opacity: 1 !important;
        }

        /* Dark Mode Overrides */
        .dark .fc-col-header-cell-cushion, 
        .dark .fc-timegrid-slot-label-cushion {
          color: #ffffff !important;
        }

        .dark .fc-timegrid-axis-cushion {
          color: #a1a1aa !important;
        }

        .dark .fc-theme-standard td, 
        .dark .fc-theme-standard th {
          border-color: #27272a !important;
        }

        .dark input[type="date"], 
        .dark input[type="time"], 
        .dark input[type="text"] {
          color: #ffffff !important;
          -webkit-text-fill-color: #ffffff !important;
        }

        .dark .fc-daygrid-day-number {
          color: #a1a1aa !important;
        }

        .dark .fc-day-today {
          background-color: rgba(59, 130, 246, 0.08) !important;
        }

        .dark .fc-timegrid-slot {
          border-bottom: 1px solid #27272a !important;
        }

        .dark .fc-timegrid-slot-minor {
          border-bottom-style: dotted !important;
          border-bottom-color: #27272a !important;
        }

        .dark .fc-timegrid-axis {
          border-color: #27272a !important;
        }
      `}</style>

      {/* FIX: White card styles (bg-white, shadow-lg, border) were removed, w-full remains for full width */}
      <div style={{ viewTransitionName: "page-content" }} className="w-full max-w-4xl h-full flex flex-col pb-[calc(6rem+env(safe-area-inset-bottom))]">
        
        {/* HEADER WITH BACK AND TITLE ON THE RIGHT */}
        <div className="flex justify-between items-center mb-6">
          <Link href={`/`} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 p-3 px-5 rounded-2xl shadow-sm text-gray-700 dark:text-zinc-300 font-bold text-sm active:scale-90 transition uppercase">
            Zurück
          </Link>
          <h1 className="text-xl font-black italic uppercase text-gray-800 dark:text-zinc-100 tracking-tighter">
            {carName}
          </h1>
          <div className="w-16"></div>
        </div>

        {/* CUSTOM TOOLBAR */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex justify-between items-center bg-white dark:bg-zinc-900 p-1.5 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800/80">
            <button onClick={goToBack} className="p-3 px-5 text-gray-700 dark:text-zinc-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-xl transition flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"></polyline>
              </svg>
            </button>

            <span onClick={goToToday} className="font-black text-black dark:text-white text-sm uppercase tracking-tight cursor-pointer active:opacity-50 text-center flex-1 italic">
              {calendarTitle}
            </span>

            <button onClick={goToNext} className="p-3 px-5 text-gray-700 dark:text-zinc-300 active:bg-gray-100 dark:active:bg-zinc-800 rounded-xl transition flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </button>
          </div>

          <div className="flex bg-white dark:bg-zinc-900 p-1 rounded-2xl shadow-sm border border-gray-100 dark:border-zinc-800/80 shrink-0">
            {[
              { id: 'dayGridMonth', label: 'Monat' },
              { id: 'timeGridThreeDay', label: '3 Tage' },
              { id: 'timeGridDay', label: 'Tag' }
            ].map((v) => (
              <button 
                key={v.id} 
                onClick={() => changeView(v.id)} 
                className={`flex-1 py-2.5 text-[10px] font-black uppercase tracking-tighter rounded-xl transition active:scale-95 ${
                  currentView === v.id 
                    ? 'bg-gray-900 dark:bg-zinc-800 text-white shadow-md' 
                    : 'text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-400'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* CALENDAR */}
        <div className="h-[65vh] bg-white dark:bg-zinc-900 p-2 rounded-3xl shadow-sm border border-gray-100 dark:border-zinc-800/80">
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridThreeDay"
            initialDate={initialDate}
            locales={[deLocale]}
            locale="de"
            headerToolbar={false}
            datesSet={(arg) => setCalendarTitle(arg.view.title)}
            events={mappedEvents}
            selectable={true}
            selectMirror={true}
            select={handleSelectSlot}
            eventClick={handleSelectEvent}
            allDaySlot={true}
            allDayText="Ganz."
            nowIndicator={true}
            height="100%"
            slotMinTime="00:00:00"
            slotLabelFormat={{ hour: '2-digit', minute: '2-digit' }}
            eventTimeFormat={{ hour: '2-digit', minute: '2-digit' }}
            selectLongPressDelay={150} 
            eventLongPressDelay={150}
            eventDisplay="block" 

            eventContent={(arg) => {
              const isMonthView = arg.view.type === 'dayGridMonth';

              if (isMonthView) {
                return (
                  <div className="flex flex-col overflow-hidden text-[10px] leading-tight text-white w-full p-0.5">
                    {arg.timeText && <span className="font-bold">{arg.timeText}</span>}
                    <span className="font-black truncate">{arg.event.title}</span>
                    <span className="font-medium truncate opacity-90">{arg.event.extendedProps.userName}</span>
                  </div>
                );
              }
              
              if (arg.event.allDay) {
                 return (
                  <div className="flex items-center overflow-hidden text-white w-full px-1 py-0.5" style={{backgroundColor: arg.event.backgroundColor}}>
                    <span className="font-black text-xs truncate ml-1">{arg.event.title} - {arg.event.extendedProps.userName}</span>
                  </div>
                );
              }

              return (
                <div className="flex flex-col p-1.5 overflow-visible text-white drop-shadow-md">
                  <span className="font-bold text-xs leading-tight drop-shadow-sm">{arg.timeText}</span>
                  <span className="font-black text-sm leading-tight truncate mt-0.5 drop-shadow-sm">{arg.event.title}</span>
                  <span className="font-medium text-xs opacity-95 truncate mt-0.5 drop-shadow-sm">{arg.event.extendedProps.userName}</span>
                </div>
              );
            }}

            views={{
              timeGridThreeDay: {
                type: 'timeGrid',
                duration: { days: 3 },
                buttonText: '3 Tage'
              }
            }}
          />
        </div>
      </div>

      {/* EDIT/DETAILS MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[2rem] shadow-2xl w-full max-w-sm border border-gray-100 dark:border-zinc-800/80 text-black dark:text-white">
            <h2 className="text-xl font-black mb-6 text-center italic uppercase tracking-tighter text-black dark:text-white">
              {editingEvent ? "Detail" : "Reservieren"}
            </h2>
            <form onSubmit={handleModalSubmit} className="flex flex-col gap-4">
              
              {/* Modern Floating Label for Reason/Title */}
              {isOwner ? (
                <div className="relative w-full">
                  <input
                    type="text"
                    id="floating_title"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="peer block w-full appearance-none rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-100 dark:bg-zinc-950 px-3 pb-2 pt-6 text-sm font-black text-black dark:text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-colors"
                    placeholder=" "
                  />
                  <label
                    htmlFor="floating_title"
                    className="absolute left-3 top-4 z-10 origin-[0] -translate-y-3 scale-75 transform text-xs font-bold uppercase text-gray-400 dark:text-zinc-500 duration-300 peer-placeholder-shown:translate-y-0 peer-placeholder-shown:scale-100 peer-focus:-translate-y-3 peer-focus:scale-75 peer-focus:text-blue-600 dark:peer-focus:text-blue-400 cursor-text pointer-events-none"
                  >
                    Titel
                  </label>
                </div>
              ) : (
                <div className="bg-gray-100 dark:bg-zinc-950 p-3 rounded-xl flex justify-between items-center border border-gray-100 dark:border-zinc-800/80">
                  <span className="text-gray-400 dark:text-zinc-500 font-bold text-xs uppercase">Titel</span>
                  <span className="font-black text-black dark:text-white text-sm">{newTitle}</span>
                </div>
              )}

              <div className="bg-gray-100 dark:bg-zinc-950 p-3 rounded-xl flex justify-between items-center border border-gray-100 dark:border-zinc-800/80">
                <span className="text-gray-400 dark:text-zinc-500 font-bold text-xs uppercase">Benutzer</span>
                <span className="font-black text-black dark:text-white text-sm">
                  {editingEvent ? editingEvent.userName : (userProfiles[user?.uid || ""]?.displayName || user?.displayName)}
                </span>
              </div>
              
              {isOwner && (
                <div className="flex items-center gap-2 px-2">
                    <input type="checkbox" id="allDay" checked={isAllDay} onChange={(e) => setIsAllDay(e.target.checked)} className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 dark:bg-zinc-950 dark:border-zinc-800"/>
                    <label htmlFor="allDay" className="text-sm font-bold text-gray-700 dark:text-zinc-350">Ganztägig</label>
                </div>
              )}

              <div className="bg-gray-100 dark:bg-zinc-950 p-4 rounded-xl flex flex-col gap-4 border border-gray-100 dark:border-zinc-800/80">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 dark:text-zinc-500 font-bold text-xs uppercase">Beginn</span>
                  {isOwner ? (
                    <div className="flex gap-1">
                      <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-2 rounded-xl text-sm font-black" />
                      {!isAllDay && <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-2 rounded-xl text-sm font-black" />}
                    </div>
                  ) : (
                    <div className="text-right font-black text-sm leading-tight">
                      <div className="text-black dark:text-white">{startDate && format(new Date(`${startDate}T${startTime}`), "dd.MM.yy")}</div>
                      {!isAllDay && <div className="text-blue-600 dark:text-blue-400">{startTime}</div>}
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400 dark:text-zinc-500 font-bold text-xs uppercase">Ende</span>
                  {isOwner ? (
                    <div className="flex gap-1">
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-2 rounded-xl text-sm font-black" />
                      {!isAllDay && <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-2 rounded-xl text-sm font-black" />}
                    </div>
                  ) : (
                    <div className="text-right font-black text-sm leading-tight">
                      <div className="text-black dark:text-white">{endDate && format(new Date(`${endDate}T${endTime}`), "dd.MM.yy")}</div>
                      {!isAllDay && <div className="text-blue-600 dark:text-blue-400">{endTime}</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-4">
                {isOwner && <button type="submit" className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl shadow-xl uppercase italic active:scale-95 transition text-sm">Speichern</button>}
                <button type="button" onClick={() => setIsModalOpen(false)} className="w-full bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 font-bold py-4 rounded-2xl uppercase text-xs active:scale-95 transition">Schließen</button>
                {isOwner && editingEvent && <button type="button" onClick={handleDelete} className="w-full bg-red-50 dark:bg-red-950/20 text-red-500 dark:text-red-400 font-bold py-3 rounded-xl uppercase text-xs mt-2 border border-red-100 dark:border-red-900/30 hover:bg-red-100 dark:hover:bg-red-950/40 active:scale-95 transition">Löschen</button>}
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}