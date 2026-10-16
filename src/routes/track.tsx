import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { CheckCircle2, Circle, Search, PackageX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { STATUS_FLOW, STATUS_META, fmtDate, type ShipmentStatus } from "@/lib/status";

type Tracked = {
  tracking_code: string; status: ShipmentStatus; city: string; receiver: string;
  created_at: string; updated_at: string; delivered_at: string | null;
  events: { status: ShipmentStatus; at: string }[];
  returns?: { kind: string; status: string; requested_at: string; events: { status: string; at: string }[] }[];
};
const RET: Record<string, string> = { requested: "Return requested", pickup_assigned: "Pickup rider assigned", picked_up: "Picked up from customer", in_transit: "Returning to hub", received: "Received at hub", cancelled: "Return closed" };
const KIND: Record<string, string> = { customer_return: "Return pickup", rto: "Return to origin", cancellation: "Cancellation" };

export const Route = createFileRoute("/track")({
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Track your parcel — Bnoy Logistics OS" },
      { name: "description", content: "Enter your tracking number or scan the QR on your parcel to see live status." },
      { property: "og:title", content: "Track your parcel — Bnoy Logistics OS" },
      { property: "og:description", content: "Live shipment status from pickup to doorstep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { code } = Route.useSearch();
  const navigate = useNavigate({ from: "/track" });
  const [input, setInput] = useState(code ?? "");
  const q = useQuery({
    queryKey: ["track", code],
    enabled: !!code,
    queryFn: async () => {
      if (!code) return null;
      const { data, error } = await supabase.rpc("track_shipment", { _code: code });
      if (error) throw error;
      return data as unknown as Tracked | null;
    },
  });
  const t = q.data;
  const reached = new Map(t?.events.map((e) => [e.status, e.at]) ?? []);

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5 sm:px-6"><Brand /></header>
      <main className="mx-auto max-w-2xl px-4 pb-16 sm:px-6">
        <h1 className="text-3xl font-bold sm:text-4xl">Track your parcel</h1>
        <form
          className="mt-6 flex gap-2"
          onSubmit={(e) => { e.preventDefault(); navigate({ search: { code: input.trim() || undefined } }); }}
        >
          <Input value={input} onChange={(e) => setInput(e.target.value)} aria-label="Tracking code or order ID" placeholder="Tracking code or order ID" className="h-12 font-mono uppercase" maxLength={120} />
          <Button type="submit" variant="hero" className="h-12 px-6"><Search /> Track</Button>
        </form>

        {q.isLoading && <div className="mt-8 h-48 animate-pulse rounded-2xl bg-muted" />}
        {q.error && <div role="alert" className="mt-8 border p-6"><p>Tracking is temporarily unavailable.</p><Button variant="outline" className="mt-3" onClick={()=>q.refetch()}>Retry</Button></div>}
        {code && !q.isLoading && !q.error && !t && (
          <div className="mt-8 rounded-2xl border bg-card p-8 text-center shadow-card">
            <PackageX className="mx-auto h-10 w-10 text-muted-foreground" />
            <p className="mt-3 font-semibold">No shipment found for “{code}”</p>
            <p className="text-sm text-muted-foreground">Check the code on your parcel label.</p>
          </div>
        )}
        {t && (
          <div className="mt-8 rounded-2xl border bg-card p-6 shadow-card animate-rise">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-lg font-bold">{t.tracking_code}</p>
                <p className="text-sm text-muted-foreground">For {t.receiver} · {t.city}</p>
              </div>
              <StatusBadge status={t.status} />
            </div>
            <ol className="mt-6 space-y-4">
              {STATUS_FLOW.map((s) => {
                const at = reached.get(s);
                return (
                  <li key={s} className="flex items-center gap-3">
                    {at ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-border" />}
                    <span className={`flex-1 text-sm ${at ? "font-semibold" : "text-muted-foreground"}`}>{STATUS_META[s].label}</span>
                    <span className="text-xs text-muted-foreground tabular">{at ? fmtDate(at) : ""}</span>
                  </li>
                );
              })}
            </ol>
            {(t.returns ?? []).map((r, i) => (
              <div key={i} className="mt-6 border-t pt-4">
                <p className="text-sm font-semibold">{KIND[r.kind] ?? "Return"}</p>
                <ol className="mt-3 space-y-2">
                  {r.events.map((e, j) => (
                    <li key={j} className="flex items-center gap-3 text-sm"><CheckCircle2 className="h-4 w-4 shrink-0 text-coral" /><span className="flex-1">{RET[e.status] ?? e.status}</span><span className="text-xs text-muted-foreground tabular">{fmtDate(e.at)}</span></li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        )}
        <div className="mt-10 rounded-2xl bg-navy p-5 text-navy-foreground">
          <p className="font-bold">Tracking API</p>
          <p className="mt-1 text-sm opacity-75">Fetch status as JSON using a tracking code or order ID.</p>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-navy-foreground/10 p-3 text-xs">GET /api/public/track/{code || "RF261014ABCDE"}</pre>
        </div>
      </main>
    </div>
  );
}
