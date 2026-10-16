import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Search, Route as RouteIcon } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Input } from "@/components/ui/input";
import { useShipments } from "@/lib/shipments";
import { CorridorAnalytics } from "@/components/CorridorMap";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/hubs")({
  head: () => pageHead("Hub network", "City hubs, delivery SLA and most affected sender to city lanes"),
  component: HubsPage,
});

const BAD = ["failed", "returned", "cancelled"];

function HubsPage() {
  const { data: rows = [], isLoading } = useShipments();
  const [q, setQ] = useState("");
  const [now] = useState(() => Date.now());

  const { hubs, lanes } = useMemo(() => {
    const h = new Map<string, { total: number; delivered: number; bad: number; open: number; onTime: number; pins: Set<string> }>();
    const l = new Map<string, { total: number; delivered: number; bad: number }>();
    for (const r of rows) {
      const g = h.get(r.city) ?? { total: 0, delivered: 0, bad: 0, open: 0, onTime: 0, pins: new Set<string>() };
      g.total++;
      if (r.pincode) g.pins.add(r.pincode);
      if (r.status === "delivered") {
        g.delivered++;
        if (r.delivered_at && new Date(r.delivered_at).getTime() - new Date(r.created_at).getTime() <= 48 * 36e5) g.onTime++;
      } else if (BAD.includes(r.status)) g.bad++;
      else g.open++;
      h.set(r.city, g);
      const key = `${r.sender_name} → ${r.city}`;
      const lg = l.get(key) ?? { total: 0, delivered: 0, bad: 0 };
      lg.total++;
      if (r.status === "delivered") lg.delivered++;
      if (BAD.includes(r.status)) lg.bad++;
      l.set(key, lg);
    }
    const hubs = [...h.entries()].map(([city, g]) => ({ city, ...g, pins: g.pins.size, sla: g.delivered ? Math.round((g.onTime / g.delivered) * 100) : null })).sort((a, b) => b.total - a.total);
    const lanes = [...l.entries()].map(([name, g]) => ({ name, ...g, pct: Math.round(((g.total - g.bad) / g.total) * 100) })).sort((a, b) => a.pct - b.pct || b.total - a.total).slice(0, 8);
    return { hubs, lanes };
  }, [rows]);

  const shown = hubs.filter((x) => x.city.toLowerCase().includes(q.toLowerCase()));
  const max = Math.max(1, ...hubs.map((x) => x.total));

  return (
    <AppShell title="Hub network">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Active city hubs" value={hubs.length} />
        <Stat label="Parcels in network" value={rows.length} />
        <Stat label="Open (not finished)" value={hubs.reduce((s, x) => s + x.open, 0)} />
      </div>

      {!isLoading && <CorridorAnalytics rows={rows} now={now} />}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="rounded-lg border bg-card shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <h2 className="flex items-center gap-2 font-bold"><MapPin className="size-4 text-primary" />City hubs</h2>
            <div className="relative w-full sm:w-56"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search city" className="pl-9" /></div>
          </div>
          {isLoading ? <p className="p-6 text-sm text-muted-foreground">Loading…</p> : shown.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No hubs yet. Create or seed shipments to see cities here.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">City</th><th className="p-3">Volume</th><th className="p-3">Delivered</th><th className="p-3">Undelivered</th><th className="p-3">SLA ≤48h</th><th className="p-3">Pincodes</th></tr></thead>
                <tbody>
                  {shown.map((x) => (
                    <tr key={x.city} className="border-t">
                      <td className="p-3 font-semibold">{x.city}</td>
                      <td className="p-3"><div className="flex items-center gap-2"><div className="h-2 w-20 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${(x.total / max) * 100}%` }} /></div><span className="tabular">{x.total}</span></div></td>
                      <td className="p-3 tabular">{x.delivered}</td>
                      <td className="p-3 tabular text-destructive">{x.bad}</td>
                      <td className="p-3 tabular">{x.sla === null ? "—" : `${x.sla}%`}</td>
                      <td className="p-3 tabular">{x.pins}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-lg border bg-card shadow-card">
          <h2 className="flex items-center gap-2 border-b p-4 font-bold"><RouteIcon className="size-4 text-primary" />Most affected lanes</h2>
          {lanes.length === 0 ? <p className="p-6 text-sm text-muted-foreground">No lanes yet.</p> : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground"><tr><th className="p-3">Sender → City</th><th className="p-3">Success</th><th className="p-3">Qty</th></tr></thead>
              <tbody>{lanes.map((l) => <tr key={l.name} className="border-t"><td className="p-3">{l.name}</td><td className={`p-3 tabular font-semibold ${l.pct < 80 ? "text-destructive" : ""}`}>{l.pct}%</td><td className="p-3 tabular">{l.total}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg border bg-card p-4 shadow-card"><p className="font-display text-3xl font-bold tabular">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>;
}
