import { pageHead } from "@/lib/seo";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { Package, Truck, CheckCircle2, IndianRupee, ScanLine, Plus, Users, Eye, Banknote, Building2, Route as RouteIcon, Sparkles, Store, Undo2 } from "lucide-react";
import { Reveal, CountUp } from "@/components/motion";
import { selectCls } from "@/lib/ui";
import heroAdmin from "@/assets/bnoy-operations.webp";
import heroDist from "@/assets/bnoy-warehouse.webp";
import heroMgr from "@/assets/bnoy-hub.webp";
import heroRider from "@/assets/rider-hero.png";
import { AppShell } from "@/components/AppShell";
import { SeedWorkspaceButton } from "@/components/SeedWorkspaceButton";
import { SetupWizard } from "@/components/SetupWizard";
import { FailureCharts } from "@/components/FailureCharts";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { useMe, useTeam } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { STATUS_FLOW, STATUS_META, ROLE_LABEL, fmtDate, inr } from "@/lib/status";

const HERO: Record<string, string> = { admin: heroAdmin, distributor: heroDist, manager: heroMgr, rider: heroRider };
type Q = { to: "/cash" | "/manage-hubs" | "/manage-merchants" | "/route-planner" | "/team" | "/manage-routes" | "/returns" | "/jobs" | "/scan" | "/wallet"; label: string; icon: typeof Package };
const QUICK: Record<string, Q[]> = {
  admin: [{ to: "/route-planner", label: "AI route plan", icon: Sparkles }, { to: "/manage-hubs", label: "Hubs", icon: Building2 }, { to: "/manage-merchants", label: "Merchants", icon: Store }, { to: "/cash", label: "Cash settlements", icon: Banknote }, { to: "/team", label: "Team", icon: Users }],
  distributor: [{ to: "/team", label: "My network", icon: Users }, { to: "/manage-routes", label: "Routes", icon: RouteIcon }, { to: "/cash", label: "Cash", icon: Banknote }, { to: "/returns", label: "Returns", icon: Undo2 }],
  manager: [{ to: "/manage-routes", label: "Routes", icon: RouteIcon }, { to: "/cash", label: "Review cash", icon: Banknote }, { to: "/scan", label: "Hub scan", icon: ScanLine }],
  rider: [{ to: "/wallet", label: "Wallet", icon: Banknote }, { to: "/scan", label: "Scan", icon: ScanLine }, { to: "/cash", label: "Hand over cash", icon: Banknote }],
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => pageHead("Dashboard", "Operations overview"),
  component: Dashboard,
});

function Dashboard() {
  const { role } = useMe();
  return role === "rider" ? <Navigate to="/rider" replace /> : role === "warehouse" ? <Navigate to="/warehouse" replace /> : <LeadDashboard />;
}

function LeadDashboard() {
  const { role: myRole, profile: me } = useMe();
  const { data: allRows = [], isLoading } = useShipments();
  const { data: team = [] } = useTeam();
  const [asId, setAsId] = useState("");
  const viewing = myRole === "admin" && asId ? team.find((t) => t.id === asId) ?? null : null;
  const role = viewing?.role ?? myRole;
  const profile = viewing ?? me;
  const rows = viewing
    ? allRows.filter((s) => [s.rider_id, s.manager_id, s.distributor_id, s.created_by].includes(viewing.id))
    : allRows;
  const quick = QUICK[role ?? "manager"] ?? QUICK["manager"] ?? [];
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
      {myRole === "admin" && <SetupWizard />}
      {myRole === "admin" && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed bg-card px-4 py-3 text-sm">
          <Eye className="h-4 w-4 text-primary" />
          <label htmlFor="viewas" className="font-semibold">View dashboard as</label>
          <select id="viewas" className={`${selectCls} max-w-xs`} value={asId} onChange={(e) => setAsId(e.target.value)}>
            <option value="">Me (admin)</option>
            {team.filter((t) => t.id !== me?.id).map((t) => <option key={t.id} value={t.id}>{t.full_name} · {t.role ? ROLE_LABEL[t.role] : "—"}</option>)}
          </select>
          {viewing && <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-primary">Read-only preview of {viewing.full_name}</span>}
        </div>
      )}
      <Reveal className="relative mb-6 overflow-hidden rounded-2xl bg-gradient-hero p-6 text-navy-foreground shadow-card sm:p-8" y={24}>
        <img src={HERO[role ?? "manager"]} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
        <div className="relative" data-reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-80">{role ? ROLE_LABEL[role] : ""} workspace</p>
          <h2 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{viewing ? `${profile?.full_name}'s day` : "Today's operations"}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {quick.map((q) => <Button key={q.to} asChild size="sm" variant="secondary"><Link to={q.to}><q.icon /> {q.label}</Link></Button>)}
          </div>
        </div>
      </Reveal>
      <Reveal className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {stats.map((s) => (
          <div key={s.label} data-reveal className="rounded-lg border bg-card p-4 shadow-card transition-transform hover:-translate-y-0.5 sm:p-5">
            <span className={`grid h-10 w-10 place-items-center rounded-md ${s.tone}`}><s.icon className="h-5 w-5" /></span>
            <p className="mt-4 font-display text-2xl font-bold tabular sm:text-3xl">{isLoading ? "…" : typeof s.value === "number" ? <CountUp value={s.value} /> : s.value}</p>
            <p className="text-xs text-muted-foreground sm:text-sm">{s.label}</p>
          </div>
        ))}
      </Reveal>

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
