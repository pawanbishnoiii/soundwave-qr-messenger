import { pageHead } from "@/lib/seo";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Layers, Plus, Printer, ScanLine, Loader2, Sparkles, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMe, useTeam } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { printLabels } from "@/lib/labels";
import { selectCls } from "@/lib/ui";
import { SeedDialog } from "@/components/SeedDialog";
import { fmtDate } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/lots")({
  head: () => pageHead("Lots & sorting", "Parcel lots sent to managers for rider sorting"),
  component: LotsPage,
});

function LotsPage() {
  const { role, user } = useMe();
  const qc = useQueryClient();
  const { data: team = [] } = useTeam();
  const { data: ships = [] } = useShipments();
  const [open, setOpen] = useState(false);
  const [seedLot, setSeedLot] = useState<string | null>(null);

  const lots = useQuery({
    queryKey: ["lots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lots").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const names = new Map(team.map((t) => [t.id, t.full_name]));
  const managers = team.filter((t) => t.role === "manager");
  const isRider = role === "rider";
  const canManage = role && !isRider;

  return (
    <AppShell
      title="Lots & sorting"
      actions={canManage && <Button variant="hero" size="sm" onClick={() => setOpen(true)}><Plus /> <span className="hidden sm:inline">New lot</span></Button>}
    >
      <div className="mb-6 rounded-lg border bg-card p-5 shadow-card">
        <p className="text-sm text-muted-foreground">
          {isRider
            ? "Your manager's lots are listed below. Tap “Start sorting”, then scan each parcel you will deliver — it is added to your account."
            : "Create a lot for a manager, add orders to it (or generate demo orders), print the labels, then riders scan parcels during sorting to claim them."}
        </p>
      </div>

      {lots.isLoading ? <Loader2 className="animate-spin" /> : (lots.data ?? []).length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card py-16 text-center">
          <Layers className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 font-semibold">No lots yet</p>
          {canManage && <Button className="mt-4" variant="hero" onClick={() => setOpen(true)}><Plus /> Create a lot</Button>}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(lots.data ?? []).map((l) => {
            const items = ships.filter((s) => s.lot_id === l.id);
            const claimed = items.filter((s) => s.rider_id).length;
            const mine = items.filter((s) => s.rider_id === user?.id).length;
            const pct = items.length ? Math.round((claimed / items.length) * 100) : 0;
            return (
              <div key={l.id} className="flex flex-col rounded-lg border bg-card p-5 shadow-card">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold">{l.code}</p>
                    <p className="truncate font-semibold">{l.name || "Untitled lot"}</p>
                    <p className="truncate text-xs text-muted-foreground">Manager: {names.get(l.manager_id) ?? "—"} · {fmtDate(l.created_at)}</p>
                  </div>
                  <span className="h-fit rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground">{pct === 100 && items.length ? "Sorted" : "Sorting"}</span>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat n={items.length} l="Parcels" />
                  <Stat n={claimed} l="Claimed" />
                  <Stat n={isRider ? mine : items.length - claimed} l={isRider ? "Mine" : "Waiting"} />
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-brand" style={{ width: `${pct}%` }} /></div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button asChild size="sm" variant={isRider ? "hero" : "outline"}>
                    <Link to="/scan" search={{ mode: isRider ? "claim" : "lot", lot: l.id }}><ScanLine /> {isRider ? "Start sorting" : "Scan into lot"}</Link>
                  </Button>
                  {canManage && (
                    <>
                      <Button size="sm" variant="outline" disabled={!items.length} onClick={() => printLabels(items).catch((e) => toast.error(e.message))}><Printer /> Labels</Button>
                      <Button size="sm" variant="outline" onClick={() => setSeedLot(l.id)}><Sparkles /> Demo orders</Button>
                      <Button size="sm" variant="ghost" className="text-destructive" onClick={async () => {
                        if (!confirm("Delete this lot? Parcels stay, they are just removed from the lot.")) return;
                        const { error } = await supabase.from("lots").delete().eq("id", l.id);
                        if (error) toast.error(error.message); else { toast.success("Lot deleted"); qc.invalidateQueries({ queryKey: ["lots"] }); }
                      }} aria-label="Delete lot"><Trash2 /></Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canManage && user && <NewLot open={open} onClose={() => setOpen(false)} managers={managers} myId={user.id} isManager={role === "manager"} />}
      {canManage && <SeedDialog lotId={seedLot} onClose={() => setSeedLot(null)} />}
    </AppShell>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return <div className="rounded-md bg-muted p-2"><p className="font-display text-xl font-bold tabular">{n}</p><p className="text-[11px] text-muted-foreground">{l}</p></div>;
}

function NewLot({ open, onClose, managers, myId, isManager }: { open: boolean; onClose: () => void; managers: { id: string; full_name: string }[]; myId: string; isManager: boolean }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const manager_id = isManager ? myId : String(fd.get("manager_id") || "");
    if (!manager_id) { toast.error("Choose a manager"); return; }
    setBusy(true);
    const { error } = await supabase.from("lots").insert({ name: String(fd.get("name") ?? "").trim().slice(0, 80), manager_id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Lot created");
    qc.invalidateQueries({ queryKey: ["lots"] });
    onClose();
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>New lot</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="lname">Lot name</Label><Input id="lname" name="name" placeholder="e.g. Morning batch — Suratgarh" maxLength={80} /></div>
          {!isManager && (
            <div className="space-y-1.5">
              <Label>Send to manager</Label>
              <select name="manager_id" className={selectCls} defaultValue="">
                <option value="" disabled>Select manager</option>
                {managers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
              </select>
              {managers.length === 0 && <p className="text-xs text-muted-foreground">Add a manager on the Team page first.</p>}
            </div>
          )}
          <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onClose}>Cancel</Button><Button variant="hero" disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

