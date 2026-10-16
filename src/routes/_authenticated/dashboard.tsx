import { pageHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Package, Truck, CheckCircle2, IndianRupee, ScanLine, Plus, Users } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { RiderHome } from "@/components/RiderHome";
import { SeedWorkspaceButton } from "@/components/SeedWorkspaceButton";
import { FailureCharts } from "@/components/FailureCharts";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useMe, useTeam } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { STATUS_FLOW, STATUS_META, fmtDate, inr } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("Dashboard", "Operations overview"),
  component: Dashboard,
});

function Dashboard() {
  const { role } = useMe();
  return role === "rider" ? <RiderHome /> : <LeadDashboard />;
}

function LeadDashboard() {
  const { role, profile } = useMe();
  const { data: rows = [], isLoading } = useShipments();
  const { data: team = [] } = useTeam();
  const today = new Date().toDateString();
  const active = rows.filter((s) => !["delivered", "failed", "returned"].includes(s.status));
  const deliveredToday = rows.filter((s) => s.delivered_at && new Date(s.delivered_at).toDateString() === today);
  const codPending = rows.filter((s) => s.status === "delivered" && !s.cod_collected).reduce((a, s) => a + Number(s.cod_amount), 0);
  const delivered = rows.filter((s) => s.status === "delivered").length;
  const rate = rows.length ? Math.round((delivered / rows.length) * 100) : 0;

  const stats = [
    { label: "Total shipments", value: rows.length, icon: Package, tone: "bg-accent text-primary" },
    { label: "Active now", value: active.length, icon: Truck, tone: "bg-sky/20 text-foreground" },
    { label: "Delivered today", value: deliveredToday.length, icon: CheckCircle2, tone: "bg-success/15 text-success" },
    { label: "COD to collect", value: inr(codPending), icon: IndianRupee, tone: "bg-coral/15 text-coral" },
  ];

  return (
    <AppShell
      title={`Hi, ${profile?.full_name?.split(" ")[0] || "there"}`}
      actions={
        <>
          {role === "admin" && <SeedWorkspaceButton />}
          <Button asChild variant="outline" size="sm"><Link to="/scan"><ScanLine /> <span className="hidden sm:inline">Scan</span></Link></Button>
          {role !== "rider" && <Button asChild variant="hero" size="sm"><Link to="/shipments" search={{ new: true }}><Plus /> <span className="hidden sm:inline">New shipment</span></Link></Button>}
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s, i) => (
          <div key={s.label} className="rounded-lg border bg-card p-4 shadow-card animate-rise sm:p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <span className={`grid h-10 w-10 place-items-center rounded-md ${s.tone}`}><s.icon className="h-5 w-5" /></span>
            <p className="mt-4 font-display text-2xl font-bold tabular sm:text-3xl">{isLoading ? "…" : s.value}</p>
            <p className="text-xs text-muted-foreground sm:text-sm">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-lg border bg-card p-5 shadow-card lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold">{role === "rider" ? "My deliveries" : "Recent shipments"}</h2>
            <Link to="/shipments" className="text-sm font-semibold text-primary">View all</Link>
          </div>
          {rows.length === 0 && !isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No shipments yet.</div>
          ) : (
            <ul className="mt-4 divide-y">
              {(role === "rider" ? active : rows).slice(0, 8).map((s) => (
                <li key={s.id}>
                  <Link to="/shipments/$id" params={{ id: s.id }} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 hover:opacity-80">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm font-semibold">{s.tracking_code}</p>
                      <p className="truncate text-xs text-muted-foreground">{s.receiver_name} · {s.city} · {fmtDate(s.created_at)}</p>
                    </div>
                    <StatusBadge status={s.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="space-y-6">
          <div className="rounded-lg bg-gradient-hero p-5 text-navy-foreground shadow-card">
            <p className="text-sm opacity-80">Delivery success rate</p>
            <p className="mt-1 font-display text-4xl font-bold tabular">{rate}%</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy-foreground/15">
              <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${rate}%` }} />
            </div>
          </div>
          <div className="rounded-lg border bg-card p-5 shadow-card">
            <h2 className="font-bold">Pipeline</h2>
            <ul className="mt-3 space-y-2.5">
              {STATUS_FLOW.map((st) => {
                const n = rows.filter((s) => s.status === st).length;
                return (
                  <li key={st} className="flex items-center gap-3 text-sm">
                    <span className="w-32 shrink-0 text-muted-foreground">{STATUS_META[st].label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-brand" style={{ width: rows.length ? `${(n / rows.length) * 100}%` : 0 }} />
                    </div>
                    <span className="w-8 text-right font-semibold tabular">{n}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          {role !== "rider" && (
            <Link to="/team" className="flex items-center gap-4 rounded-lg border bg-card p-5 shadow-card hover:border-primary">
              <span className="grid h-10 w-10 place-items-center rounded-md bg-lime text-navy"><Users className="h-5 w-5" /></span>
              <div>
                <p className="font-bold tabular">{Math.max(team.length - 1, 0)} team members</p>
                <p className="text-xs text-muted-foreground">{team.filter((t) => t.role === "rider").length} riders</p>
              </div>
            </Link>
          )}
        </section>
      </div>
      <FailureCharts rows={rows} />
    </AppShell>
  );
}
