import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, IndianRupee, KeyRound, PackageOpen, RotateCcw, Truck, UserPlus, CheckCircle2 } from "lucide-react";
import type { ComponentType } from "react";
import { pageHead } from "@/lib/seo";
import { AppShell } from "@/components/AppShell";
import { useMe } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { supabase } from "@/integrations/supabase/client";
import { inr } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/jobs")({
  head: () => pageHead("Jobs", "Automatic to-do list built from your parcels, returns and cash"),
  component: Jobs,
});

type Job = { key: string; title: string; hint: string; icon: ComponentType<{ className?: string }>; tone: string; items: { id: string; code: string; label: string }[] };

function Jobs() {
  const { role, user } = useMe();
  const { data: rows = [] } = useShipments();
  const { data: returns = [] } = useQuery({
    queryKey: ["jobs-returns"],
    queryFn: async () => {
      const { data } = await supabase.from("return_requests").select("id,status,kind,rider_id,shipment_id").not("status", "in", "(received,cancelled)");
      return data ?? [];
    },
  });
  const rider = role === "rider";
  const mine = rider ? rows.filter((s) => s.rider_id === user?.id) : rows;
  const item = (s: (typeof rows)[number]) => ({ id: s.id, code: s.tracking_code, label: `${s.receiver_name} · ${s.city}` });
  const stale = Date.now() - 24 * 3600e3;

  const jobs: Job[] = (rider
    ? [
        { key: "pickup", title: "Pick up from hub", hint: "Assigned to you, not picked up yet", icon: PackageOpen, tone: "bg-accent text-primary", items: mine.filter((s) => s.status === "assigned").map(item) },
        { key: "deliver", title: "Deliver today", hint: "Out for delivery — send OTP 1234 at the door", icon: Truck, tone: "bg-sky/20 text-foreground", items: mine.filter((s) => ["picked_up", "in_transit", "out_for_delivery"].includes(s.status)).map(item) },
        { key: "retry", title: "Re-attempt failed", hint: "Customer wasn't reached last time", icon: AlertTriangle, tone: "bg-coral/15 text-coral", items: mine.filter((s) => s.status === "failed").map(item) },
        { key: "cod", title: "Hand over COD cash", hint: "Collected cash to deposit with your manager", icon: IndianRupee, tone: "bg-success/15 text-success", items: mine.filter((s) => s.status === "delivered" && !s.cod_collected && Number(s.cod_amount) > 0).map((s) => ({ ...item(s), label: `${inr(Number(s.cod_amount))} · ${s.receiver_name}` })) },
        { key: "returns", title: "Return pickups", hint: "Collect from customer with photos", icon: RotateCcw, tone: "bg-accent text-primary", items: returns.filter((r) => r.rider_id === user?.id).map((r) => ({ id: r.shipment_id, code: r.kind, label: r.status.replace(/_/g, " ") })) },
      ]
    : [
        { key: "assign", title: "Assign a rider", hint: "New parcels with no rider yet", icon: UserPlus, tone: "bg-accent text-primary", items: mine.filter((s) => s.status === "created" && !s.rider_id).map(item) },
        { key: "stuck", title: "Stuck over 24 hours", hint: "No status change for a day", icon: AlertTriangle, tone: "bg-coral/15 text-coral", items: mine.filter((s) => !["delivered", "returned", "cancelled", "created"].includes(s.status) && new Date(s.updated_at).getTime() < stale).map(item) },
        { key: "failed", title: "Failed deliveries", hint: "Re-attempt or start a return", icon: Truck, tone: "bg-sky/20 text-foreground", items: mine.filter((s) => s.status === "failed").map(item) },
        { key: "otp", title: "OTP sent, not delivered", hint: "Customer has the code — follow up", icon: KeyRound, tone: "bg-accent text-primary", items: mine.filter((s) => s.otp_sent_at && s.status !== "delivered").map(item) },
        { key: "cod", title: "COD to collect from riders", hint: "Delivered but cash not marked received", icon: IndianRupee, tone: "bg-success/15 text-success", items: mine.filter((s) => s.status === "delivered" && !s.cod_collected && Number(s.cod_amount) > 0).map((s) => ({ ...item(s), label: `${inr(Number(s.cod_amount))} · ${s.receiver_name}` })) },
        { key: "returns", title: "Returns need a rider", hint: "Requested, no pickup rider yet", icon: RotateCcw, tone: "bg-coral/15 text-coral", items: returns.filter((r) => !r.rider_id).map((r) => ({ id: r.shipment_id, code: r.kind, label: r.status.replace(/_/g, " ") })) },
      ]);

  const total = jobs.reduce((a, j) => a + j.items.length, 0);

  return (
    <AppShell title="Jobs">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">
        Jobs are created automatically from your parcels, returns and cash. When the work is done, the job disappears. {total ? `${total} open right now.` : ""}
      </p>
      {total === 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border bg-card p-5"><CheckCircle2 className="size-5 text-success" /><p className="text-sm font-medium">All clear — nothing needs you right now.</p></div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {jobs.map((j) => (
          <section key={j.key} className="rounded-xl border bg-card p-5 shadow-card">
            <div className="flex items-start gap-3">
              <span className={`grid size-10 shrink-0 place-items-center rounded-lg ${j.tone}`}><j.icon className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{j.title}</h2>
                <p className="text-xs text-muted-foreground">{j.hint}</p>
              </div>
              <span className="font-mono text-2xl font-semibold">{j.items.length}</span>
            </div>
            <ul className="mt-4 space-y-1">
              {j.items.slice(0, 5).map((it) => (
                <li key={j.key + it.id + it.code}>
                  <Link to="/shipments/$id" params={{ id: it.id }} className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted">
                    <span className="font-mono text-xs text-primary">{it.code}</span>
                    <span className="truncate text-xs text-muted-foreground">{it.label}</span>
                  </Link>
                </li>
              ))}
              {j.items.length > 5 && <li className="px-2 pt-1 text-xs text-muted-foreground">+{j.items.length - 5} more</li>}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
