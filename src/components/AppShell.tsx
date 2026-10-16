import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, Package, ScanLine, Users, LogOut, Menu, X, Layers, Plug, Undo2, KeyRound, Trophy, ListChecks, Wallet, MapPin, Barcode } from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { ROLE_LABEL } from "@/lib/status";
import { Brand } from "./Brand";
import { Button } from "./ui/button";

type Role = "admin" | "distributor" | "manager" | "rider";
const ALL: Role[] = ["admin", "distributor", "manager", "rider"];
const LEADS: Role[] = ["admin", "distributor", "manager"];
const ADMIN: Role[] = ["admin"];
const GROUPS = [
  { title: "Operations", items: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL },
    { to: "/jobs", label: "Jobs", icon: ListChecks, roles: ALL },
    { to: "/shipments", label: "Shipments", icon: Package, roles: ALL },
    { to: "/scan", label: "Scan", icon: ScanLine, roles: ALL },
    { to: "/lots", label: "Lots", icon: Layers, roles: ALL },
    { to: "/returns", label: "Returns", icon: Undo2, roles: ALL },
  ] },
  { title: "Analytics & warehouse", items: [
    { to: "/hubs", label: "Hub network", icon: MapPin, roles: LEADS },
    { to: "/manifest", label: "Barcode manifest", icon: Barcode, roles: LEADS },
    { to: "/riders", label: "Rider performance", icon: Trophy, roles: LEADS },
  ] },
  { title: "Network & settings", items: [
    { to: "/team", label: "Team", icon: Users, roles: LEADS },
    { to: "/payouts", label: "Pay & bonuses", icon: Wallet, roles: ADMIN },
    { to: "/providers", label: "Courier partners", icon: Plug, roles: ADMIN },
    { to: "/developers", label: "API & webhooks", icon: KeyRound, roles: ADMIN },
  ] },
] as const;
const NAV = GROUPS.flatMap((g) => [...g.items]) as Array<(typeof GROUPS)[number]["items"][number]>;

export function AppShell({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  const { profile, role, user } = useMe();
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const current = NAV.find((n) => path.startsWith(n.to));
  const blocked = !!role && !!current && !(current.roles as readonly string[]).includes(role);

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const nav = (
    <nav className="flex flex-col gap-5 overflow-y-auto">
      {GROUPS.map((g) => {
        const items = g.items.filter((n) => role && (n.roles as readonly string[]).includes(role));
        if (!items.length) return null;
        return (
          <div key={g.title} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-sidebar-foreground/60">{g.title}</p>
            {items.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                activeProps={{ className: "bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary" }}
              >
                <n.icon className="h-4 w-4 shrink-0" />
                {n.label}
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );

  const userCard = (
    <div className="rounded-md border border-sidebar-border p-3">
      <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{profile?.full_name || user?.email}</p>
      <p className="truncate text-xs text-sidebar-foreground">{role ? ROLE_LABEL[role] : "No role yet"}</p>
      <Button variant="ghost" size="sm" onClick={signOut} className="mt-3 h-auto p-0 text-xs text-sidebar-foreground hover:bg-transparent hover:text-sidebar-accent-foreground">
        <LogOut className="h-3.5 w-3.5" /> Sign out
      </Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col justify-between bg-sidebar p-4 lg:flex">
        <div className="min-h-0 space-y-6 overflow-y-auto">
          <Brand light />
          {nav}
        </div>
        {userCard}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy/60" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col justify-between bg-sidebar p-4 animate-in slide-in-from-left">
            <div className="space-y-8">
              <div className="flex items-center justify-between">
                <Brand light />
                <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close menu" className="text-sidebar-foreground"><X /></Button>
              </div>
              {nav}
            </div>
            {userCard}
          </aside>
        </div>
      )}

      <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <Button variant="ghost" size="icon" className="shrink-0 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu /></Button>
          <h1 className="truncate text-lg font-bold sm:text-xl">{title}</h1>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </header>

      <main className="px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-8">
        {!role && user ? (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center shadow-card">
            <h2 className="text-xl font-bold">Waiting for access</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your account is created. Ask your admin, distributor or manager to add you to their team.
            </p>
          </div>
        ) : blocked ? (
          <div className="mx-auto max-w-md rounded-2xl border bg-card p-8 text-center shadow-card">
            <h2 className="text-xl font-bold">Not available for your role</h2>
            <p className="mt-2 text-sm text-muted-foreground">This page is for team leads. Use Jobs or Scan for your daily work.</p>
            <Button asChild variant="hero" size="sm" className="mt-5"><Link to="/jobs">Open my jobs</Link></Button>
          </div>
        ) : (
          children
        )}
      </main>

      {/* Mobile bottom bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid auto-cols-fr grid-flow-col border-t bg-card pb-[env(safe-area-inset-bottom)] lg:hidden">
        {NAV.slice(0, 5).map((n) => (
          <Link
            key={n.to}
            to={n.to}
            className="flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground"
            activeProps={{ className: "text-primary" }}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
