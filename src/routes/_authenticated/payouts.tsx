import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Gift, Trash2 } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useMe, useTeam } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { useBonuses, usePayoutSettings } from "@/lib/payouts";
import { inr } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/payouts")({
  head: () => pageHead("Delivery pay & bonuses", "Set how much each role earns per delivery, plus festival and sale bonuses"),
  component: Payouts,
});

const RATE_FIELDS = [
  { key: "rider_delivery", label: "Rider · per delivery" },
  { key: "rider_return", label: "Rider · per return collected" },
  { key: "manager_delivery", label: "Manager · per delivery in team" },
  { key: "distributor_delivery", label: "Distributor · per delivery in network" },
  { key: "franchise_commission_pct", label: "Franchise commission · % of COD", pct: true },
  { key: "manager_commission_pct", label: "Manager commission · % of COD", pct: true },
  { key: "rider_cod_commission_pct", label: "Rider commission · % of COD", pct: true },
] as const;

function Payouts() {
  const { role } = useMe();
  const admin = role === "admin";
  const qc = useQueryClient();
  const { data: settings } = usePayoutSettings();
  const { data: bonuses = [] } = useBonuses();
  const [rates, setRates] = useState<Record<string, string>>({});
  const [b, setB] = useState({ name: "", kind: "festival", rider_bonus: "5", manager_bonus: "0", distributor_bonus: "0", starts_on: "", ends_on: "" });
  const today = new Date().toISOString().slice(0, 10);
  const { data: team = [] } = useTeam();
  const { data: ships = [] } = useShipments();
  const pct = (k: "franchise_commission_pct" | "manager_commission_pct") => Number(settings?.[k] ?? 0) / 100;
  const franchise = team.filter((t) => t.role === "distributor" || t.role === "manager").map((t) => {
    const mine = ships.filter((x) => (t.role === "distributor" ? x.distributor_id : x.manager_id) === t.id && x.status === "delivered");
    const cod = mine.reduce((a, x) => a + Number(x.cod_amount), 0);
    const pending = mine.filter((x) => !x.cod_handover_id).reduce((a, x) => a + Number(x.cod_amount), 0);
    return { ...t, delivered: mine.length, cod, pending, commission: cod * pct(t.role === "distributor" ? "franchise_commission_pct" : "manager_commission_pct") };
  });

  useEffect(() => {
    if (settings) setRates(Object.fromEntries(RATE_FIELDS.map((f) => [f.key, String(settings[f.key])])));
  }, [settings]);

  async function saveRates() {
    const patch = Object.fromEntries(RATE_FIELDS.map((f) => [f.key, Math.max(0, Number(rates[f.key] || 0))]));
    const { error } = await supabase.from("payout_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", 1);
    if (error) { toast.error(error.message); return; }
    toast.success("Delivery pay saved — applies to the next delivery");
    qc.invalidateQueries({ queryKey: ["payout-settings"] });
  }

  async function addBonus() {
    if (b.name.trim().length < 2 || !b.starts_on || !b.ends_on) { toast.error("Add a name and both dates"); return; }
    if (b.ends_on < b.starts_on) { toast.error("End date must be after start date"); return; }
    const { error } = await supabase.from("payout_bonuses").insert({
      name: b.name.trim(), kind: b.kind, starts_on: b.starts_on, ends_on: b.ends_on,
      rider_bonus: Number(b.rider_bonus || 0), manager_bonus: Number(b.manager_bonus || 0), distributor_bonus: Number(b.distributor_bonus || 0),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Bonus added");
    setB({ ...b, name: "" });
    qc.invalidateQueries({ queryKey: ["payout-bonuses"] });
  }

  async function toggle(id: string, active: boolean) {
    await supabase.from("payout_bonuses").update({ active }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["payout-bonuses"] });
  }
  async function remove(id: string) {
    await supabase.from("payout_bonuses").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["payout-bonuses"] });
  }

  return (
    <AppShell title="Delivery pay & bonuses">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <section className="rounded-xl border bg-card p-6 shadow-card">
          <h2 className="font-semibold">Pay per parcel</h2>
          <p className="mt-1 text-sm text-muted-foreground">Credited to wallets automatically when a parcel is delivered or a return reaches the hub.</p>
          <div className="mt-5 space-y-4">
            {RATE_FIELDS.map((f) => (
              <div key={f.key} className="grid grid-cols-[minmax(0,1fr)_120px] items-center gap-3">
                <Label htmlFor={f.key}>{f.label}</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{"pct" in f ? "%" : "₹"}</span>
                  <Input id={f.key} type="number" min={0} step="0.5" className="pl-7" disabled={!admin} value={rates[f.key] ?? ""} onChange={(e) => setRates({ ...rates, [f.key]: e.target.value })} />
                </div>
              </div>
            ))}
          </div>
          {admin ? <Button variant="hero" className="mt-6" onClick={saveRates}>Save pay rates</Button> : <p className="mt-6 text-xs text-muted-foreground">Only admins can change pay rates.</p>}
        </section>

        <section className="rounded-xl border bg-card p-6 shadow-card">
          <div className="flex items-center gap-2"><Gift className="size-4 text-primary" /><h2 className="font-semibold">Festival & sale bonuses</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">Extra amount added per delivery while the bonus is running (e.g. Diwali, Big Billion sale).</p>
          {admin && (
            <div className="mt-5 grid gap-3 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Label>Name</Label><Input placeholder="Diwali rush" value={b.name} onChange={(e) => setB({ ...b, name: e.target.value })} /></div>
              <div><Label>Type</Label>
                <select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={b.kind} onChange={(e) => setB({ ...b, kind: e.target.value })}>
                  <option value="festival">Festival</option><option value="sale">Sale</option>
                </select>
              </div>
              <div><Label>Rider extra ₹</Label><Input type="number" min={0} value={b.rider_bonus} onChange={(e) => setB({ ...b, rider_bonus: e.target.value })} /></div>
              <div><Label>Manager extra ₹</Label><Input type="number" min={0} value={b.manager_bonus} onChange={(e) => setB({ ...b, manager_bonus: e.target.value })} /></div>
              <div><Label>Distributor extra ₹</Label><Input type="number" min={0} value={b.distributor_bonus} onChange={(e) => setB({ ...b, distributor_bonus: e.target.value })} /></div>
              <div><Label>Starts</Label><Input type="date" value={b.starts_on} onChange={(e) => setB({ ...b, starts_on: e.target.value })} /></div>
              <div><Label>Ends</Label><Input type="date" value={b.ends_on} onChange={(e) => setB({ ...b, ends_on: e.target.value })} /></div>
              <Button variant="hero" className="sm:col-span-2" onClick={addBonus}>Add bonus</Button>
            </div>
          )}
          <ul className="mt-5 divide-y">
            {bonuses.length === 0 && <li className="py-4 text-sm text-muted-foreground">No bonuses yet.</li>}
            {bonuses.map((x) => {
              const live = x.active && x.starts_on <= today && x.ends_on >= today;
              return (
                <li key={x.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{x.name} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[11px] capitalize text-muted-foreground">{x.kind}</span>{live && <span className="ml-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] text-success">Live</span>}</p>
                    <p className="text-xs text-muted-foreground">{x.starts_on} → {x.ends_on} · Rider +{inr(Number(x.rider_bonus))} · Manager +{inr(Number(x.manager_bonus))} · Distributor +{inr(Number(x.distributor_bonus))}</p>
                  </div>
                  {admin && <>
                    <Button size="sm" variant="outline" onClick={() => toggle(x.id, !x.active)}>{x.active ? "Pause" : "Resume"}</Button>
                    <Button size="icon" variant="ghost" aria-label="Delete bonus" onClick={() => remove(x.id)}><Trash2 className="size-4" /></Button>
                  </>}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
      {admin && (
        <section className="mt-6 rounded-xl border bg-card p-6 shadow-card">
          <h2 className="font-semibold">Franchise & manager cash</h2>
          <p className="mt-1 text-sm text-muted-foreground">COD collected in each franchise (distributor) and manager team, cash not yet settled, and commission at the rates above.</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Name</th><th>Role</th><th className="text-right">Delivered</th><th className="text-right">COD collected</th><th className="text-right">Not settled</th><th className="text-right">Commission</th></tr></thead>
              <tbody className="divide-y">
                {franchise.map((f) => (
                  <tr key={f.id}><td className="py-2 font-medium">{f.full_name}</td><td className="capitalize">{f.role === "distributor" ? "Franchise" : "Manager"}</td><td className="text-right tabular">{f.delivered}</td><td className="text-right tabular">{inr(f.cod)}</td><td className="text-right tabular text-coral">{inr(f.pending)}</td><td className="text-right font-semibold tabular text-success">{inr(Math.round(f.commission))}</td></tr>
                ))}
                {franchise.length === 0 && <tr><td colSpan={6} className="py-4 text-muted-foreground">No franchises or managers yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </AppShell>
  );
}
