import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useMapsSetting } from "@/lib/public-settings";

type Stop = { label: string; query: string; done: boolean; lat?: number; lng?: number };
declare global { interface Window { bnoyMapsReady?: () => void; gm_authFailure?: () => void; google?: any } }
let googleLoading: Promise<void> | undefined;
function loadGoogle(key: string) {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (googleLoading) return googleLoading;
  googleLoading = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Google Maps unavailable")), 12000);
    window.bnoyMapsReady = () => { window.clearTimeout(timeout); resolve(); };
    window.gm_authFailure = () => { window.clearTimeout(timeout); reject(new Error("Google Maps authorization failed")); };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&loading=async&callback=bnoyMapsReady&channel=${encodeURIComponent(import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID'] ?? '')}`;
    script.async = true;
    script.onerror = () => { window.clearTimeout(timeout); reject(new Error("Google Maps could not load")); };
    document.head.appendChild(script);
  }).catch((error) => { googleLoading = undefined; throw error; });
  return googleLoading;
}

/** OpenStreetMap tracking map. Places are geocoded with the free Nominatim service. */
export default function TrackMap({ stops }: { stops: Stop[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState("Locating parcel…");
  const settings = useMapsSetting();
  useEffect(() => {
    if (!el.current || settings.isLoading) return;
    const container = el.current;
    let map: L.Map | undefined;
    let cancelled = false;
    (async () => {
      const pts: [number, number, Stop][] = [];
      for (const s of stops) {
        if (Number.isFinite(s.lat) && Number.isFinite(s.lng) && s.lat !== undefined && s.lng !== undefined) { pts.push([s.lat, s.lng, s]); continue; }
        try {
          // Explicit keyless fallback: only unresolved place names use Nominatim.
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(s.query)}`);
          const j = (await r.json()) as { lat: string; lon: string }[];
          if (j[0]) pts.push([Number(j[0].lat), Number(j[0].lon), s]);
        } catch { /* skip */ }
      }
      if (cancelled) return;
      const key = settings.data?.google_key || import.meta.env['VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY'];
      if (settings.data?.provider !== "osm" && key) {
        try {
          await loadGoogle(key); if (cancelled) return;
          const gm = window.google?.maps;
          if (!gm?.Map) throw new Error("Map unavailable");
          const gmap = new gm.Map(container, { center: { lat: 22.5, lng: 79 }, zoom: 5, clickableIcons: false, gestureHandling: "cooperative", mapTypeControl: false });
          const bounds = new gm.LatLngBounds();
          pts.forEach(([lat, lng, stop]) => { new gm.Marker({ map: gmap, position: { lat, lng }, title: stop.label }); bounds.extend({ lat, lng }); });
          if (pts.length) gmap.fitBounds(bounds, 40);
          if (pts.length > 1) new gm.Polyline({ map: gmap, path: pts.map(([lat, lng]) => ({ lat, lng })) });
          setMsg(pts.length ? "Google Maps · latest recorded locations" : "No recorded location yet"); return;
        } catch { if (cancelled) return; }
      }
      container.replaceChildren();
      map = L.map(container, { scrollWheelZoom: false }).setView([22.5, 79], 4.5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
      const osm = map;
      if (!pts.length) { setMsg("Location not available on the map yet"); return; }
      setMsg("OpenStreetMap · latest recorded locations");
      pts.forEach(([lat, lon, s], i) => {
        const last = i === pts.length - 1;
        L.circleMarker([lat, lon], { radius: last ? 10 : 7, color: s.done ? "#16a34a" : "#94a3b8", fillOpacity: 0.85, weight: 3 }).addTo(osm).bindTooltip(s.label, { permanent: last, direction: "top" });
      });
      if (pts.length > 1) L.polyline(pts.map(([a, b]) => [a, b] as L.LatLngTuple), { color: "#2563eb", weight: 3, dashArray: "6 8" }).addTo(osm);
      osm.fitBounds(L.latLngBounds(pts.map(([a, b]) => [a, b] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 11 });
    })();
    return () => { cancelled = true; map?.remove(); container.replaceChildren(); };
  }, [stops, settings.data?.provider, settings.data?.google_key, settings.isLoading]);
  return <div className="relative"><div ref={el} className="h-72 w-full overflow-hidden rounded-xl border" />{msg && <p className="absolute inset-x-0 bottom-2 text-center text-xs text-muted-foreground">{msg}</p>}</div>;
}
