import { useMemo } from "react";
import { Bar, BarChart, Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

type Row = { status: string; city: string; sender_name: string; created_at: string; updated_at: string; delivered_at?: string | null };
const UNDELIVERED = ["failed", "returned", "cancelled"] as const;
const LABEL: Record<string, string> = { failed: "Delivery failed", returned: "Returned (RTO)", cancelled: "Cancelled" };
const COLOR: Record<string, string> = { failed: "var(--coral)", returned: "var(--primary)", cancelled: "var(--sky)" };

export function FailureCharts({ rows }: { rows: Row[] }) {
  const { sla, tat, trend, breakup, total, cities, senders } = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - 13 + i);
      return d.toISOString().slice(0, 10);
    });
    const trend = days.map((day) => {
      const dayRows = rows.filter((r) => r.created_at.slice(0, 10) === day);
      const bad = dayRows.filter((r) => (UNDELIVERED as readonly string[]).includes(r.status)).length;
      return { day: new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), pct: dayRows.length ? Math.round((bad / dayRows.length) * 1000) / 10 : 0 };
    });
    const breakup = UNDELIVERED.map((s) => ({ key: s, name: LABEL[s], value: rows.filter((r) => r.status === s).length }));
    const group = (key: "city" | "sender_name") => {
      const m = new Map<string, { total: number; bad: number }>();
      rows.forEach((r) => { const g = m.get(r[key]) ?? { total: 0, bad: 0 }; g.total++; if ((UNDELIVERED as readonly string[]).includes(r.status)) g.bad++; m.set(r[key], g); });
      return [...m.entries()].map(([name, g]) => ({ name, ...g, pct: Math.round((g.bad / g.total) * 100) })).filter((g) => g.bad > 0).sort((a, b) => b.pct - a.pct || b.bad - a.bad).slice(0, 5);
    };
    const hrs = (r: Row) => (new Date(r.delivered_at!).getTime() - new Date(r.created_at).getTime()) / 36e5;
    const del = rows.filter((r) => r.status === "delivered" && r.delivered_at);
    const sla = days.map((day) => {
      const d = del.filter((r) => r.delivered_at!.slice(0, 10) === day);
      return { day: new Date(day).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), pct: d.length ? Math.round((d.filter((r) => hrs(r) <= 48).length / d.length) * 100) : null };
    });
    const buckets: [string, number, number][] = [["< 1 day", 0, 24], ["1–2 days", 24, 48], ["2–3 days", 48, 72], ["3+ days", 72, Infinity]];
    const tat = buckets.map(([name, a, b]) => ({ name, value: del.filter((r) => hrs(r) >= a && hrs(r) < b).length }));
    return { sla, tat, trend, breakup, total: breakup.reduce((a, b) => a + b.value, 0), cities: group("city"), senders: group("sender_name") };
  }, [rows]);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border bg-card p-5 shadow-card">
        <h2 className="font-bold">Undelivered %</h2>
        <p className="text-xs text-muted-foreground">Share of each day's bookings that failed, returned or were cancelled · last 14 days</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ left: -20, right: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
              <YAxis unit="%" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <Tooltip formatter={(v) => [`${v}%`, "Undelivered"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="pct" stroke="var(--primary)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-lg border bg-card p-5 shadow-card">
        <h2 className="font-bold">Undelivered reason breakup</h2>
        <div className="relative mt-2 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={total ? breakup : [{ key: "none", name: "None", value: 1 }]} dataKey="value" innerRadius="62%" outerRadius="88%" paddingAngle={total ? 2 : 0} stroke="none">
                {(total ? breakup : [{ key: "none" }]).map((b) => <Cell key={b.key} fill={COLOR[b.key] ?? "var(--muted)"} />)}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div><p className="text-3xl font-bold tabular">{total}</p><p className="text-xs text-muted-foreground">Undelivered</p></div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-4 text-xs">
          {breakup.map((b) => <span key={b.key} className="flex items-center gap-1.5"><span className="size-2.5 rounded-full" style={{ background: COLOR[b.key] }} />{b.name} · {b.value}</span>)}
        </div>
      </section>
      <section className="rounded-lg border bg-card p-5 shadow-card">
        <h2 className="font-bold">SLA trend</h2>
        <p className="text-xs text-muted-foreground">Delivered within 48 hours of booking · last 14 days</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sla} margin={{ left: -20, right: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" />
              <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <Tooltip formatter={(v) => [`${v}%`, "Within SLA"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="pct" connectNulls stroke="var(--success)" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="rounded-lg border bg-card p-5 shadow-card">
        <h2 className="font-bold">TAT breakup</h2>
        <p className="text-xs text-muted-foreground">Delivered parcels by time from booking to doorstep</p>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={tat} margin={{ left: -20, right: 8 }}>
              <CartesianGrid stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <Tooltip formatter={(v) => [v, "Parcels"]} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <FailTable title="Most failing areas" head="City" rows={cities} />
      <FailTable title="Most failing senders" head="Sender" rows={senders} />
    </div>
  );
}

function FailTable({ title, head, rows }: { title: string; head: string; rows: { name: string; total: number; bad: number; pct: number }[] }) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-card">
      <h2 className="font-bold">{title}</h2>
      <table className="mt-3 w-full text-sm">
        <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 font-medium">{head}</th><th className="font-medium">Fail %</th><th className="font-medium">Failed</th><th className="text-right font-medium">Total</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={4} className="py-4 text-center text-muted-foreground">No failed parcels yet.</td></tr>}
          {rows.map((r) => <tr key={r.name} className="border-b last:border-0"><td className="max-w-[10rem] truncate py-2">{r.name}</td><td className="tabular">{r.pct}%</td><td className="tabular">{r.bad}</td><td className="text-right tabular">{r.total}</td></tr>)}
        </tbody>
      </table>
    </section>
  );
}
