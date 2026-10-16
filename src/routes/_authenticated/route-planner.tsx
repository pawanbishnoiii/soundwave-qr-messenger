import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Route as RouteIcon, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useMe } from "@/lib/auth";
import { selectCls } from "@/lib/ui";
import { pageHead } from "@/lib/seo";
import { Reveal } from "@/components/motion";
import { planDeliveryRoute, type RoutePlan } from "@/lib/route-plan.functions";

export const Route = createFileRoute("/_authenticated/route-planner")({
  head: () => pageHead("AI route planner", "Get a prioritised delivery sequence for a hub's pending parcels"),
  component: Planner,
});

function Planner() {
  const { role } = useMe();
  const run = useServerFn(planDeliveryRoute);
  const hubs = useQuery({ queryKey: ["hubs-lite"], queryFn: async () => (await supabase.from("hubs").select("id,name,city").order("name")).data ?? [] });
  const [hub, setHub] = useState("");
  const [constraints, setConstraints] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<(RoutePlan & { hub: string; count: number }) | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!hub) { toast.error("Pick a hub"); return; }
    setBusy(true); setPlan(null);
    try { setPlan(await run({ data: { hubId: hub, constraints } })); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  if (role && role !== "admin") return <AppShell title="AI route planner"><p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">AI tools are available to admins only.</p></AppShell>;
  return (
    <AppShell title="AI route planner">
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border bg-card p-5 shadow-card">
          <div><Label htmlFor="hub">Hub</Label>
            <select id="hub" className={selectCls} value={hub} onChange={(e) => setHub(e.target.value)}>
              <option value="">Select hub…</option>
              {hubs.data?.map((h) => <option key={h.id} value={h.id}>{h.name} · {h.city}</option>)}
            </select></div>
          <div><Label htmlFor="c">Delivery constraints</Label>
            <Textarea id="c" rows={5} value={constraints} onChange={(e) => setConstraints(e.target.value)} placeholder="e.g. 1 bike, max 25 kg, rider starts 10am, market area closed after 2pm" /></div>
          <Button type="submit" disabled={busy} className="w-full">{busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Plan route</Button>
          <p className="text-xs text-muted-foreground">Uses the hub's pending parcels. Review before dispatching.</p>
        </form>
        <div>
          {!plan && !busy && <div className="grid h-full min-h-60 place-items-center rounded-2xl border border-dashed bg-card p-10 text-center text-sm text-muted-foreground"><div><RouteIcon className="mx-auto mb-2 h-8 w-8" />Pick a hub and add constraints to get a suggested sequence.</div></div>}
          {busy && <div className="h-60 animate-pulse rounded-2xl bg-muted" />}
          {plan && (
            <div className="space-y-4">
              <div className="rounded-2xl border bg-card p-5 shadow-card">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{plan.hub} · {plan.count} parcels · ~{plan.estimated_hours} h</p>
                <p className="mt-1 font-medium">{plan.summary}</p>
                {!!plan.warnings.length && <ul className="mt-3 list-disc pl-5 text-sm text-destructive">{plan.warnings.map((w) => <li key={w}>{w}</li>)}</ul>}
              </div>
              <Reveal as="ol" className="space-y-2" stagger={0.04}>
                {plan.stops.map((s, i) => (
                  <li key={s.tracking_code} data-reveal className="flex gap-3 rounded-xl border bg-card p-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-sm font-bold text-primary-foreground">{i + 1}</span>
                    <div className="min-w-0"><p className="font-mono text-sm font-semibold">{s.tracking_code} <span className="ml-2 font-sans text-xs text-muted-foreground">{s.window}</span></p><p className="text-sm text-muted-foreground">{s.reason}</p></div>
                  </li>
                ))}
              </Reveal>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
