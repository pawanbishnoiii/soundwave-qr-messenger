import { useMemo, useState } from "react";
import { AlertTriangle, MapPin, Package, TrendingUp } from "lucide-react";
import { INDIA_OUTLINE } from "@/lib/india-outline";
import type { Shipment } from "@/lib/status";

// Hub positions on the 400x460 India outline canvas (lon/lat projected).
const HUBS: Record<string, { x: number; y: number }> = {
  Delhi: { x: 127, y: 128 }, Jaipur: { x: 109, y: 152 }, Lucknow: { x: 176, y: 154 }, Kolkata: { x: 274, y: 214 },
  Ahmedabad: { x: 67, y: 208 }, Indore: { x: 110, y: 213 }, Mumbai: { x: 71, y: 265 }, Pune: { x: 84, y: 273 },
  Hyderabad: { x: 144, y: 289 }, Bengaluru: { x: 132, y: 352 }, Chennai: { x: 168, y: 351 },
};
const FEATURED = ["Delhi", "Mumbai", "Bengaluru", "Indore"];
const CORRIDORS: Array<[string, string]> = [
  ["Delhi", "Mumbai"], ["Delhi", "Indore"], ["Indore", "Mumbai"], ["Mumbai", "Bengaluru"], ["Delhi", "Bengaluru"],
  ["Delhi", "Kolkata"], ["Bengaluru", "Chennai"], ["Mumbai", "Pune"], ["Hyderabad", "Bengaluru"], ["Delhi", "Jaipur"],
];
const OPEN = ["assigned", "picked_up", "in_transit", "out_for_delivery", "created"];
const SLA_H = 48;
const norm = (c: string) => Object.keys(HUBS).find((k) => c.toLowerCase().includes(k.toLowerCase()) || (k === "Bengaluru" && /bangalore/i.test(c)) || (k === "Delhi" && /gurgaon|gurugram|noida/i.test(c)));

function slaOf(list: Shipment[]) {
  const done = list.filter((r) => r.status === "delivered" && r.delivered_at);
  if (!done.length) return null;
  const ok = done.filter((r) => new Date(r.delivered_at!).getTime() - new Date(r.created_at).getTime() <= SLA_H * 36e5).length;
  return Math.round((ok / done.length) * 100);
}
const tone = (p: number | null) => (p === null ? "var(--muted-foreground)" : p >= 90 ? "var(--primary)" : p >= 75 ? "var(--chart-4, orange)" : "var(--destructive)");

export function CorridorAnalytics({ rows, now }: { rows: Shipment[]; now: number }) {
  const [sel, setSel] = useState<string>("Delhi");
  const byHub = useMemo(() => {
    const m = new Map<string, Shipment[]>();
    for (const r of rows) { const h = norm(r.city); if (h) m.set(h, [...(m.get(h) ?? []), r]); }
    return m;
  }, [rows]);
  const corridors = CORRIDORS.map(([a, b]) => {
    const list = [...(byHub.get(a) ?? []), ...(byHub.get(b) ?? [])];
    return { id: `${a}-${b}`, a, b, sla: slaOf(list) };
  });

  const hubName = HUBS[sel] ? sel : "Delhi";
  const hubRows = byHub.get(hubName) ?? [];
  const hubSla = slaOf(hubRows);
  const delivered = hubRows.filter((r) => r.status === "delivered").length;
  const open = hubRows.filter((r) => OPEN.includes(r.status)).length;
  const hubBreaches = hubRows
    .filter((r) => OPEN.includes(r.status) && now - new Date(r.created_at).getTime() > SLA_H * 36e5)
    .map((r) => ({ r, hours: Math.round((now - new Date(r.created_at).getTime()) / 36e5) }))
    .sort((a, b) => b.hours - a.hours);

  const weeks = useMemo(() => {
    const out: { label: string; sla: number | null; n: number }[] = [];
    for (let w = 7; w >= 0; w--) {
      const end = now - w * 7 * 864e5, start = end - 7 * 864e5;
      const list = hubRows.filter((r) => { const t = new Date(r.created_at).getTime(); return t > start && t <= end; });
      out.push({ label: w === 0 ? "This wk" : `-${w}w`, sla: slaOf(list), n: list.length });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hubName, rows, now]);

  return (
    <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_1fr]">
      <section className="rounded-lg border bg-card shadow-card">
        <div className="border-b p-4">
          <h2 className="font-bold">India logistics network</h2>
          <p className="mt-1 text-xs text-muted-foreground">Tap a hub city for its on-time numbers and 48-hour breach alerts.</p>
        </div>
        <div className="p-4">
          <svg viewBox="0 0 400 460" className="w-full max-h-[520px]" role="img" aria-label="India logistics map">
            {INDIA_OUTLINE.map((d, i) => (
              <path key={i} d={d} fill="var(--muted)" fillOpacity={0.5} stroke="var(--border)" strokeWidth={1.2} strokeLinejoin="round" />
            ))}
            {corridors.map((c) => {
              const A = HUBS[c.a]!, B = HUBS[c.b]!, on = c.a === hubName || c.b === hubName;
              return (
                <line key={c.id} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={tone(c.sla)} strokeWidth={on ? 2.5 : 1.5} strokeDasharray={on ? undefined : "4 5"} opacity={on ? 0.9 : 0.45} />
              );
            })}
            {Object.entries(HUBS).map(([name, p]) => {
              const n = byHub.get(name)?.length ?? 0;
              const breachesN = (byHub.get(name) ?? []).filter((r) => OPEN.includes(r.status) && now - new Date(r.created_at).getTime() > SLA_H * 36e5).length;
              const active = name === hubName;
              const featured = FEATURED.includes(name);
              return (
                <g key={name} onClick={() => setSel(name)} className="cursor-pointer" role="button" aria-label={`${name} hub`}>
                  <circle cx={p.x} cy={p.y} r={featured ? 16 : 10} fill="transparent" />
                  {active && <circle cx={p.x} cy={p.y} r={9 + Math.min(n, 20) / 4} fill="var(--primary)" opacity={0.2} />}
                  <circle cx={p.x} cy={p.y} r={4 + Math.min(n, 20) / 4} fill={breachesN ? "var(--destructive)" : "var(--primary)"} opacity={n ? 0.95 : 0.4} stroke={active ? "var(--foreground)" : "none"} strokeWidth={active ? 1.5 : 0} />
                  {breachesN > 0 && <circle cx={p.x} cy={p.y} r={7 + Math.min(n, 20) / 4} fill="none" stroke="var(--destructive)" strokeWidth={1} opacity={0.6} />}
                  <text x={p.x + 8} y={p.y + 4} fontSize={featured ? 12 : 10} fill="var(--foreground)" fontWeight={featured ? 700 : 500}>{name}</text>
                </g>
              );
            })}
          </svg>
        </div>
      </section>

      <div className="space-y-6">
        <section className="rounded-lg border bg-card p-4 shadow-card">
          <h2 className="flex items-center gap-2 font-bold"><MapPin className="size-4 text-primary" />{hubName} hub</h2>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-md border p-2"><p className="font-display text-xl font-bold tabular">{hubRows.length}</p><p className="text-[10px] text-muted-foreground">Parcels</p></div>
            <div className="rounded-md border p-2"><p className="font-display text-xl font-bold tabular">{delivered}</p><p className="text-[10px] text-muted-foreground">Delivered</p></div>
            <div className="rounded-md border p-2"><p className="font-display text-xl font-bold tabular" style={{ color: tone(hubSla) }}>{hubSla === null ? "—" : `${hubSla}%`}</p><p className="text-[10px] text-muted-foreground">On-time ≤{SLA_H}h</p></div>
          </div>
          {hubRows.length === 0 && <p className="mt-3 text-xs text-muted-foreground">No parcels routed to {hubName} yet — numbers fill in as shipments arrive.</p>}
        </section>

        <section className="rounded-lg border bg-card p-4 shadow-card">
          <h2 className="flex items-center gap-2 font-bold"><TrendingUp className="size-4 text-primary" />On-time SLA trend · {hubName}</h2>
          <p className="text-xs text-muted-foreground">Delivered within {SLA_H}h, last 8 weeks · {open} open now</p>
          <div className="mt-4 flex h-36 items-end gap-2">
            {weeks.map((w) => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular text-muted-foreground">{w.sla === null ? "—" : `${w.sla}%`}</span>
                <div className="w-full rounded-t" style={{ height: `${Math.max(4, w.sla ?? 0)}%`, background: tone(w.sla) }} />
                <span className="text-[10px] text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border bg-card shadow-card">
          <h2 className="flex items-center gap-2 border-b p-4 font-bold"><AlertTriangle className="size-4 text-destructive" />48h breach alerts · {hubName}</h2>
          {hubBreaches.length === 0 ? <p className="p-4 text-sm text-muted-foreground">No open parcels past the {SLA_H}h SLA in {hubName}.</p> : (
            <ul className="divide-y text-sm">
              {hubBreaches.slice(0, 8).map(({ r, hours }) => (
                <li key={r.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0"><a href={`/shipments/${r.id}`} className="font-mono font-semibold text-primary">{r.tracking_code}</a><p className="truncate text-xs text-muted-foreground"><Package className="mr-1 inline size-3" />{r.receiver_name} · {r.status.replace(/_/g, " ")}</p></div>
                  <span className="shrink-0 rounded-md bg-destructive/15 px-2 py-1 text-xs font-semibold text-destructive">+{hours - SLA_H}h late</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
