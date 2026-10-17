import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, ListOrdered, Loader2, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeam } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { selectCls } from "@/lib/ui";
import { inr } from "@/lib/status";
import { pageHead } from "@/lib/seo";
import { DEFAULT_CONSTRAINTS, FLAG_LABEL, planStops, type Constraints } from "@/lib/stop-plan";

export const Route = createFileRoute("/_authenticated/stop-planner")({
  head: () => pageHead("Stop planner", "Order a rider's bucket into a practical delivery sequence with risk flags"),
  component: StopPlanner,
});

const BUCKET = ["assigned", "picked_up", "hub_received", "sorted", "out_for_delivery", "reattempt"];

function StopPlanner() {
  const { data: team = [] } = useTeam();
  const { data: ships = [] } = useShipments();
  const riders = team.filter((t) => t.role === "rider");
  const [rider, setRider] = useState("");
  const [c, setC] = useState<Constraints>(DEFAULT_CONSTRAINTS);
  const [busy, setBusy] = useState(false);
  const bucket = ships.filter((s) => s.rider_id === rider && BUCKET.includes(s.status));
  const plan = useMemo(() => (rider ? planStops(bucket, c) : null), [rider, bucket, c]);
  const num = (k: keyof Constraints) => (e: React.ChangeEvent<HTMLInputElement>) => setC({ ...c, [k]: Number(e.target.value) || 0 });

  async function apply() {
    if (!plan?.stops.length) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("apply_stop_order", { _ids: plan.stops.map((s) => s.parcel.id) });
    setBusy(false);
    if (error) toast.error(error.message); else toast.success(`Stop order applied to ${data} parcels`);
  }

  return (
    <AppShell title="Stop planner">
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
          <div><Label htmlFor="r">Rider</Label>
            <select id="r" className={selectCls} value={rider} onChange={(e) => setRider(e.target.value)}>
              <option value="">Select rider…</option>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name || r.phone}</option>)}
            </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Max stops</Label><Input type="number" value={c.maxStops} onChange={num("maxStops")} /></div>
            <div><Label>Max weight (kg)</Label><Input type="number" value={c.maxWeightKg} onChange={num("maxWeightKg")} /></div>
            <div><Label>High cash from ₹</Label><Input type="number" value={c.highCod} onChange={num("highCod")} /></div>
            <div><Label>Start hour</Label><Input type="number" min={0} max={23} value={c.startHour} onChange={num("startHour")} /></div>
          </div>
          <div><Label>Priority</Label>
            <select className={selectCls} value={c.priority} onChange={(e) => setC({ ...c, priority: e.target.value as Constraints["priority"] })}>
              <option value="deadline">Deadlines first</option><option value="cash">High cash first</option><option value="express">Express first</option>
            </select></div>
          <Button className="w-full" disabled={!plan?.stops.length || busy} onClick={apply}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Apply to rider's route</Button>
          <p className="text-xs text-muted-foreground">Rule-based ordering: groups by pincode, then deadline, express, reattempts and cash.</p>
        </div>
        <div>
          {!plan && <div className="grid min-h-60 place-items-center rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground"><div><ListOrdered className="mx-auto mb-2 h-8 w-8" />Pick a rider to see their bucket in suggested order.</div></div>}
          {plan && !plan.stops.length && <p className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">This rider has no parcels in their bucket.</p>}
          {plan && !!plan.stops.length && (
            <ol className="space-y-2">
              {plan.stops.map((s) => (
                <li key={s.parcel.id} className="flex gap-3 rounded-xl border bg-card p-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{s.order}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">{s.parcel.tracking_code} <span className="font-sans text-xs text-muted-foreground">· {s.parcel.pincode} · {s.parcel.weight_kg} kg{Number(s.parcel.cod_amount) > 0 && ` · COD ${inr(Number(s.parcel.cod_amount))}`}</span></p>
                    <p className="truncate text-sm text-muted-foreground">{s.parcel.receiver_address}, {s.parcel.city}</p>
                    {!!s.flags.length && <div className="mt-1 flex flex-wrap gap-1">{s.flags.map((f) => <span key={f} className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning"><AlertTriangle className="h-3 w-3" />{FLAG_LABEL[f]}</span>)}</div>}
                  </div>
                </li>
              ))}
              {!!plan.skipped.length && <p className="pt-2 text-sm text-destructive">{plan.skipped.length} parcel(s) left out by your stop or weight limits.</p>}
            </ol>
          )}
        </div>
      </div>
    </AppShell>
  );
}
