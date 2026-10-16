import { pageHead } from "@/lib/seo";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { UserPlus, Trash2, Loader2, Search, Package, CheckCircle2, Crown, Building2, Briefcase, Bike } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useShipments } from "@/lib/shipments";
import { useMe, useTeam, type TeamMember } from "@/lib/auth";
import { createMember, moveMember, removeMember } from "@/lib/team.functions";
import { selectCls } from "@/lib/ui";
import { ROLE_LABEL, ROLE_RANK, creatableRoles, type AppRole } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/team")({
  head: () => pageHead("Team", "Distributors, managers and riders"),
  component: TeamPage,
});

const ICON: Record<AppRole, typeof Crown> = { admin: Crown, distributor: Building2, manager: Briefcase, rider: Bike };
const TONE: Record<AppRole, string> = {
  admin: "bg-navy text-navy-foreground",
  distributor: "bg-accent text-primary",
  manager: "bg-sky/25 text-foreground",
  rider: "bg-lime text-navy",
};

function TeamPage() {
  const { role, user } = useMe();
  const { data: team = [], isLoading } = useTeam();
  const qc = useQueryClient();
  const remove = useServerFn(removeMember);
  const move = useServerFn(moveMember);
  const [open, setOpen] = useState(false);
  const [parentFor, setParentFor] = useState<string | null>(null);
  const { data: ships = [] } = useShipments();
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | AppRole>("all");
  const stats = useMemo(() => {
    const m = new Map<string, { active: number; delivered: number }>();
    const bump = (id: string | null, st: string) => {
      if (!id) return;
      const g = m.get(id) ?? { active: 0, delivered: 0 };
      if (st === "delivered") g.delivered++;
      else if (!["failed", "returned", "cancelled", "created"].includes(st)) g.active++;
      m.set(id, g);
    };
    for (const r of ships) { bump(r.rider_id, r.status); if (r.manager_id !== r.rider_id) bump(r.manager_id, r.status); if (r.distributor_id !== r.manager_id) bump(r.distributor_id, r.status); }
    return m;
  }, [ships]);
  const filtering = q.trim() !== "" || tab !== "all";
  const flat = team.filter((t) => (tab === "all" || t.role === tab) && `${t.full_name} ${t.phone ?? ""}`.toLowerCase().includes(q.trim().toLowerCase()));

  const ids = new Set(team.map((t) => t.id));
  const children = useMemo(() => {
    const m = new Map<string | null, TeamMember[]>();
    for (const t of team) {
      const key = t.parent_id && ids.has(t.parent_id) ? t.parent_id : null;
      m.set(key, [...(m.get(key) ?? []), t]);
    }
    return m;
  }, [team]);

  const canManage = role && role !== "rider";
  const counts = (["distributor", "manager", "rider"] as AppRole[]).map((r) => ({ r, n: team.filter((t) => t.role === r).length }));

  async function onRemove(m: TeamMember) {
    if (!confirm(`Remove ${m.full_name}? Their team will move up one level.`)) return;
    try { await remove({ data: { id: m.id } }); toast.success("Member removed"); qc.invalidateQueries({ queryKey: ["team"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }
  async function onMove(m: TeamMember, parent_id: string) {
    try { await move({ data: { id: m.id, parent_id } }); toast.success("Moved"); qc.invalidateQueries({ queryKey: ["team"] }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); }
  }

  function Node({ m, depth }: { m: TeamMember; depth: number }) {
    const Icon = m.role ? ICON[m.role] : Bike;
    const kids = children.get(m.id) ?? [];
    const parents = team.filter((p) => p.role && m.role && ROLE_RANK[p.role] > ROLE_RANK[m.role] && p.id !== m.id);
    const editable = canManage && m.id !== user?.id && m.role !== "admin";
    return (
      <li>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border bg-card p-3 shadow-card" style={{ marginLeft: Math.min(depth, 4) * 16 }}>
          <div className="flex min-w-0 items-center gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${m.role ? TONE[m.role] : "bg-muted"}`}><Icon className="h-5 w-5" /></span>
            <div className="min-w-0">
              <p className="truncate font-semibold">{m.full_name}{m.id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}</p>
              <p className="truncate text-xs text-muted-foreground">{m.role ? ROLE_LABEL[m.role] : "No role"}{m.phone ? ` · ${m.phone}` : ""}</p>
              <p className="mt-1 flex gap-3 text-xs"><span className="flex items-center gap-1 text-primary"><Package className="h-3 w-3" />{stats.get(m.id)?.active ?? 0} active</span><span className="flex items-center gap-1 text-muted-foreground"><CheckCircle2 className="h-3 w-3" />{stats.get(m.id)?.delivered ?? 0} delivered</span></p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {canManage && m.role && m.role !== "rider" && (
              <Button size="sm" variant="ghost" onClick={() => { setParentFor(m.id); setOpen(true); }} aria-label={`Add under ${m.full_name}`}><UserPlus /></Button>
            )}
            {editable && parents.length > 1 && (
              <select className={`${selectCls} hidden h-8 w-36 sm:block`} value={m.parent_id ?? ""} onChange={(e) => onMove(m, e.target.value)} aria-label="Reports to">
                {parents.map((p) => <option key={p.id} value={p.id}>↑ {p.full_name}</option>)}
              </select>
            )}
            {editable && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onRemove(m)} aria-label="Remove"><Trash2 /></Button>}
          </div>
        </div>
        {!filtering && kids.length > 0 && <ul className="mt-2 space-y-2">{kids.map((k) => <Node key={k.id} m={k} depth={depth + 1} />)}</ul>}
      </li>
    );
  }

  return (
    <AppShell
      title="Team"
      actions={canManage && <Button variant="hero" size="sm" onClick={() => { setParentFor(null); setOpen(true); }}><UserPlus /> <span className="hidden sm:inline">Add member</span></Button>}
    >
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {counts.map(({ r, n }) => {
          const Icon = ICON[r];
          return (
            <div key={r} className="rounded-lg border bg-card p-4 shadow-card">
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${TONE[r]}`}><Icon className="h-4 w-4" /></span>
              <p className="mt-3 font-display text-2xl font-bold tabular">{n}</p>
              <p className="text-xs text-muted-foreground">{ROLE_LABEL[r]}s</p>
            </div>
          );
        })}
      </div>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-bold">{filtering ? `${flat.length} member${flat.length === 1 ? "" : "s"}` : "Admin → Distributor → Manager → Rider"}</h2>
        <div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or mobile" className="pl-9" aria-label="Search team" /></div>
      </div>
      <div className="mt-3 mb-4 flex gap-2 overflow-x-auto pb-1">
        {(["all", "admin", "distributor", "manager", "rider"] as const).map((r) => (
          <button key={r} onClick={() => setTab(r)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${tab === r ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>
            {r === "all" ? "All" : `${ROLE_LABEL[r]}s`} <span className="opacity-70">{r === "all" ? team.length : team.filter((t) => t.role === r).length}</span>
          </button>
        ))}
      </div>
      {isLoading ? <Loader2 className="animate-spin" /> : filtering ? (
        flat.length === 0 ? <p className="text-sm text-muted-foreground">No members match.</p> : <ul className="space-y-2">{flat.map((m) => <Node key={m.id} m={m} depth={0} />)}</ul>
      ) : (
        <ul className="space-y-2">{(children.get(null) ?? []).map((m) => <Node key={m.id} m={m} depth={0} />)}</ul>
      )}
      {canManage && role && user && <AddDialog open={open} onClose={() => setOpen(false)} team={team} myRole={role} myId={user.id} defaultParent={parentFor} />}
    </AppShell>
  );
}

function AddDialog({ open, onClose, team, myRole, myId, defaultParent }: {
  open: boolean; onClose: () => void; team: TeamMember[]; myRole: AppRole; myId: string; defaultParent: string | null;
}) {
  const qc = useQueryClient();
  const create = useServerFn(createMember);
  const roles = creatableRoles(myRole);
  const parentRow = team.find((t) => t.id === defaultParent);
  const initialRole: AppRole = parentRow?.role === "distributor" ? "manager" : parentRow?.role === "manager" ? "rider" : (roles[0] ?? "rider");
  const [role, setRole] = useState<AppRole>(initialRole);
  const [parent, setParent] = useState<string>(defaultParent ?? myId);
  const [busy, setBusy] = useState(false);
  const parents = team.filter((t) => t.role && ROLE_RANK[t.role] > ROLE_RANK[role]);

  // reset when reopened
  const key = `${open}-${defaultParent}`;
  const [lastKey, setLastKey] = useState(key);
  if (key !== lastKey) { setLastKey(key); setRole(initialRole); setParent(defaultParent ?? myId); }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    try {
      await create({ data: {
        full_name: String(fd.get("full_name")),
        phone: String(fd.get("phone") ?? "").replace(/[^0-9]/g, "").replace(/^91(?=[0-9]{10}$)/, ""), role, parent_id: role === "admin" ? null : parents.some((p) => p.id === parent) ? parent : myId,
      } });
      toast.success(`${ROLE_LABEL[role]} added. They can sign in with their mobile number and OTP.`);
      qc.invalidateQueries({ queryKey: ["team"] });
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Add team member</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {roles.map((r) => {
              const Icon = ICON[r];
              return (
                <button type="button" key={r} onClick={() => setRole(r)} className={`flex flex-col items-center gap-1 rounded-md border p-3 text-xs font-semibold ${role === r ? "border-primary bg-accent text-primary" : ""}`}>
                  <Icon className="h-5 w-5" />{ROLE_LABEL[r]}
                </button>
              );
            })}
          </div>
          {role !== "admin" && (
            <div className="space-y-1.5">
              <Label>Reports to</Label>
              <select className={selectCls} value={parent} onChange={(e) => setParent(e.target.value)}>
                {parents.map((p) => <option key={p.id} value={p.id}>{p.full_name} ({p.role && ROLE_LABEL[p.role]})</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Riders can report to a manager or directly to a distributor.</p>
            </div>
          )}
          <div className="space-y-1.5"><Label htmlFor="full_name">Full name</Label><Input id="full_name" name="full_name" required minLength={2} maxLength={100} /></div>
          <div className="space-y-1.5"><Label htmlFor="phone">Mobile number (login)</Label><Input id="phone" name="phone" type="tel" inputMode="numeric" required maxLength={13} placeholder="10-digit mobile" /><p className="text-xs text-muted-foreground">They sign in with this number and an OTP — no password needed.</p></div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="hero" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Add {ROLE_LABEL[role]}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
