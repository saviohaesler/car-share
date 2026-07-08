"use client";

import { useEffect, useRef, useState, use, useMemo } from "react";
import { collection, doc, getDoc, getDocs, orderBy, query, Timestamp } from "firebase/firestore";
import { db, auth } from "../../../lib/firebase";
import { Link } from "next-view-transitions";
import { User } from "firebase/auth";
import { useSearchParams } from "next/navigation";
import { useUserProfiles } from "../../../lib/useUserProfiles";
import { useTheme } from "../../../lib/useTheme";
import { decodePolyline } from "../../../lib/polyline";
import { formatKm } from "../../../lib/logs";
import type * as Leaflet from "leaflet";
import "leaflet/dist/leaflet.css";

// Kartenansicht: automatisch aufgezeichnete Strecken (cars/{id}/routes) in der
// Farbe der jeweiligen Person plus letzter bekannter Standort des Autos.
// Filterbar nach Person und Zeitraum (analog zur Statistik).

interface RouteEntry {
  id: string;
  userId: string;
  points: [number, number][];
  end: [number, number];
  distanceMeters: number;
  date: Date | null;
}

type TimeRange = "1m" | "3m" | "6m" | "12m" | "all";

const RANGE_DAYS: Record<Exclude<TimeRange, "all">, number> = {
  "1m": 30,
  "3m": 91,
  "6m": 182,
  "12m": 365,
};

export default function MapPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const [user, setUser] = useState<User | null>(null);
  const [carName, setCarName] = useState("Lade...");
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("3m");
  const [hiddenUsers, setHiddenUsers] = useState<Set<string>>(new Set());
  const { theme } = useTheme();
  const searchParams = useSearchParams();
  const focusedRouteId = searchParams.get("routeId");

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const tileRef = useRef<Leaflet.TileLayer | null>(null);
  const routesLayerRef = useRef<Leaflet.LayerGroup | null>(null);
  const carMarkerRef = useRef<Leaflet.Marker | null>(null);
  const [L, setL] = useState<typeof Leaflet | null>(null);

  const userProfiles = useUserProfiles([user?.uid, ...routes.map((r) => r.userId)]);

  // Leaflet nur im Browser laden (kein SSR)
  useEffect(() => {
    let mounted = true;
    import("leaflet").then((mod) => {
      if (!mounted) return;
      const lib = (mod as { default?: typeof Leaflet }).default ?? (mod as unknown as typeof Leaflet);
      setL(lib);
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (u) => {
      if (!u) {
        window.location.href = "/";
        return;
      }
      setUser(u);
      try {
        const carDoc = await getDoc(doc(db, "cars", resolvedParams.id));
        if (!carDoc.exists()) {
          window.location.href = "/";
          return;
        }
        const members: string[] = carDoc.data().members || [];
        if (!members.includes(u.uid)) {
          alert("Du bist kein Mitglied dieses Teams.");
          window.location.href = "/";
          return;
        }
        setCarName(carDoc.data().name || "Auto");

        const snap = await getDocs(
          query(collection(db, "cars", resolvedParams.id, "routes"), orderBy("timestamp", "desc"))
        );
        const loaded: RouteEntry[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (typeof data.points !== "string" || typeof data.userId !== "string") return;
          const points = decodePolyline(data.points);
          if (points.length < 2) return;
          loaded.push({
            id: d.id,
            userId: data.userId,
            points,
            end: [
              typeof data.endLat === "number" ? data.endLat : points[points.length - 1][0],
              typeof data.endLng === "number" ? data.endLng : points[points.length - 1][1],
            ],
            distanceMeters: Number(data.distanceMeters) || 0,
            date: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : null,
          });
        });
        setRoutes(loaded);
      } catch (error) {
        console.error(error);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [resolvedParams.id]);

  // Karte initialisieren
  useEffect(() => {
    if (!L || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { 
      zoomControl: false, 
      attributionControl: false
    });
    map.setView([46.8, 8.2], 8); // Schweiz als Ausgangsansicht
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.remove();
      mapRef.current = null;
      tileRef.current = null;
      routesLayerRef.current = null;
      carMarkerRef.current = null;
    };
  }, [L]);

  // Kacheln passend zum Hell-/Dunkelmodus
  useEffect(() => {
    if (!L || !mapRef.current) return;
    if (tileRef.current) tileRef.current.remove();
    tileRef.current = L.tileLayer(
      `https://{s}.basemaps.cartocdn.com/${theme === "dark" ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png`,
      {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }
    ).addTo(mapRef.current);
  }, [L, theme]);

  const rangeStart = useMemo(() => {
    if (timeRange === "all") return null;
    return new Date(Date.now() - RANGE_DAYS[timeRange] * 24 * 60 * 60 * 1000);
  }, [timeRange]);

  const visibleRoutes = useMemo(
    () => {
      if (focusedRouteId) {
        return routes.filter((r) => r.id === focusedRouteId);
      }
      return routes.filter(
        (r) =>
          !hiddenUsers.has(r.userId) &&
          (!rangeStart || (r.date !== null && r.date >= rangeStart))
      );
    },
    [routes, hiddenUsers, rangeStart, focusedRouteId]
  );

  // Personen, die in den geladenen Routen vorkommen (für die Filter-Chips)
  const routeUsers = useMemo(() => {
    const ids: string[] = [];
    routes.forEach((r) => {
      if (!ids.includes(r.userId)) ids.push(r.userId);
    });
    return ids;
  }, [routes]);

  // Strecken zeichnen
  useEffect(() => {
    if (!L || !mapRef.current) return;
    if (routesLayerRef.current) routesLayerRef.current.remove();
    const layer = L.layerGroup();
    const bounds = L.latLngBounds([]);

    visibleRoutes.forEach((r) => {
      const color = userProfiles[r.userId]?.color || "#3b82f6";
      const line = L.polyline(r.points, { color, weight: 4, opacity: 0.85 });
      const name = userProfiles[r.userId]?.displayName || "Unbekannt";
      const dateStr = r.date ? r.date.toLocaleString("de-DE", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) + " Uhr" : "";
      line.bindPopup(
        `<b>${name}</b><br>${dateStr} · ${formatKm(Math.round(r.distanceMeters / 1000))} km`
      );
      line.addTo(layer);
      r.points.forEach((p) => bounds.extend(p));
    });

    layer.addTo(mapRef.current);
    routesLayerRef.current = layer;
    if (bounds.isValid()) {
      mapRef.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
    }
  }, [L, visibleRoutes, userProfiles]);

  // Letzter bekannter Standort des Autos (Ende der neuesten Route,
  // unabhängig von den Filtern)
  useEffect(() => {
    if (!L || !mapRef.current) return;
    if (carMarkerRef.current) {
      carMarkerRef.current.remove();
      carMarkerRef.current = null;
    }
    const latest = routes[0];
    if (!latest) return;
    const icon = L.divIcon({
      className: "",
      html:
        '<div style="width:34px;height:34px;border-radius:50%;background:#3b82f6;border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;">' +
        '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a1 1 0 0 0-.8-.4H5.24a2 2 0 0 0-1.8 1.1l-.8 1.63A6 6 0 0 0 2 12.42V16h2"/><circle cx="6.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>' +
        "</div>",
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
    const marker = L.marker(latest.end, { icon, zIndexOffset: 1000 });
    const dateStr = latest.date
      ? `${latest.date.toLocaleDateString("de-DE")}, ${latest.date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`
      : "";
    marker.bindPopup(`<b>${carName}</b><br>Letzter bekannter Standort<br>${dateStr}`);
    marker.addTo(mapRef.current);
    carMarkerRef.current = marker;
  }, [L, routes, carName]);

  const toggleUser = (uid: string) => {
    setHiddenUsers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  if (!user) return null;

  return (
    <main className="w-full h-[100dvh] flex flex-col items-center px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] bg-gray-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden relative transition-colors duration-200">
      <div style={{ viewTransitionName: "page-content" }} className="w-full max-w-md lg:max-w-4xl flex flex-col h-full">

        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
          <Link href={`/`} className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 p-3 px-5 rounded-2xl shadow-sm text-gray-700 dark:text-zinc-300 font-bold text-sm active:scale-90 transition uppercase">
            Zurück
          </Link>
          <h1 className="text-xl font-black italic uppercase text-gray-800 dark:text-zinc-100 tracking-tighter">
            {carName}
          </h1>
          <div className="w-16"></div>
        </div>

        {/* MAP CONTAINER */}
        <div className="relative isolate flex-1 w-full bg-white dark:bg-zinc-900 rounded-[2rem] shadow-sm border border-gray-100 dark:border-zinc-800/80 overflow-hidden min-h-[300px]">
          <div className="absolute top-4 left-4 right-4 z-[500] flex flex-col gap-2 pointer-events-none">
            {!focusedRouteId && (
              <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-zinc-800/80 pointer-events-auto flex justify-between gap-1 max-w-full overflow-x-auto custom-scrollbar">
                {(["1m", "3m", "6m", "12m", "all"] as TimeRange[]).map((tr) => (
                  <button
                    key={tr}
                    onClick={() => setTimeRange(tr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition shrink-0 ${
                      timeRange === tr
                        ? "bg-black dark:bg-white text-white dark:text-black shadow-md"
                        : "text-gray-500 hover:bg-gray-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {tr === "all" ? "Alle" : tr.replace("m", " Mt.")}
                  </button>
                ))}
              </div>
            )}

            {!focusedRouteId && routeUsers.length > 0 && (
              <div className="bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-zinc-800/80 pointer-events-auto flex gap-2 max-w-full overflow-x-auto custom-scrollbar">
                {routeUsers.map((uid) => {
                  const active = !hiddenUsers.has(uid);
                  const color = userProfiles[uid]?.color || "#3b82f6";
                  return (
                    <button
                      key={uid}
                      onClick={() => toggleUser(uid)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-2xl border text-xs font-black uppercase tracking-tight shrink-0 transition active:scale-95 ${
                        active
                          ? "bg-white dark:bg-zinc-900 border-gray-100 dark:border-zinc-800/80 text-gray-800 dark:text-zinc-100 shadow-sm"
                          : "bg-gray-100 dark:bg-zinc-900/40 border-transparent text-gray-400 dark:text-zinc-600 opacity-60"
                      }`}
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color, opacity: active ? 1 : 0.4 }}></span>
                      {userProfiles[uid]?.displayName || "Unbekannt"}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div ref={containerRef} className="absolute inset-0" />
          {(loading || !L) && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 dark:bg-zinc-950/80 z-[500]">
              <p className="text-sm font-black text-gray-400 dark:text-zinc-500 italic uppercase">Lade Karte...</p>
            </div>
          )}
          {!loading && L && routes.length === 0 && (
            <div className="absolute inset-x-4 bottom-4 z-[500]">
              <div className="bg-white dark:bg-zinc-900 p-4 rounded-2xl border border-gray-100 dark:border-zinc-800/80 shadow-lg text-center">
                <p className="text-xs font-black text-gray-400 dark:text-zinc-500 italic uppercase">Noch keine aufgezeichneten Strecken</p>
                <p className="text-[10px] font-bold text-gray-300 dark:text-zinc-600 uppercase mt-1">Fahrten mit Auto-Tracking erscheinen hier</p>
              </div>
            </div>
          )}
        </div>


      </div>
    </main>
  );
}
