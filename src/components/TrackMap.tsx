import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Stop = { label: string; query: string; done: boolean };

/** OpenStreetMap tracking map. Places are geocoded with the free Nominatim service. */
export default function TrackMap({ stops }: { stops: Stop[] }) {
  const el = useRef<HTMLDivElement>(null);
  const [msg, setMsg] = useState("Locating parcel…");
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false }).setView([22.5, 79], 4.5);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors", maxZoom: 18 }).addTo(map);
    let cancelled = false;
    (async () => {
      const pts: [number, number, Stop][] = [];
      for (const s of stops) {
        try {
          const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(s.query)}`);
          const j = (await r.json()) as { lat: string; lon: string }[];
          if (j[0]) pts.push([Number(j[0].lat), Number(j[0].lon), s]);
        } catch { /* skip */ }
      }
      if (cancelled) return;
      if (!pts.length) { setMsg("Location not available on the map yet"); return; }
      setMsg("");
      pts.forEach(([lat, lon, s], i) => {
        const last = i === pts.length - 1;
        L.circleMarker([lat, lon], { radius: last ? 10 : 7, color: s.done ? "#16a34a" : "#94a3b8", fillOpacity: 0.85, weight: 3 }).addTo(map).bindTooltip(s.label, { permanent: last, direction: "top" });
      });
      if (pts.length > 1) L.polyline(pts.map(([a, b]) => [a, b] as L.LatLngTuple), { color: "#2563eb", weight: 3, dashArray: "6 8" }).addTo(map);
      map.fitBounds(L.latLngBounds(pts.map(([a, b]) => [a, b] as L.LatLngTuple)), { padding: [40, 40], maxZoom: 11 });
    })();
    return () => { cancelled = true; map.remove(); };
  }, [stops]);
  return <div className="relative"><div ref={el} className="h-72 w-full overflow-hidden rounded-xl border" />{msg && <p className="absolute inset-x-0 bottom-2 text-center text-xs text-muted-foreground">{msg}</p>}</div>;
}
