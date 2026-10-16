import { pageHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Printer, ChevronRight, XCircle, Undo2, IndianRupee, Trash2, Loader2, Phone, MapPin, Copy, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { StatusBadge } from "@/components/StatusBadge";
import { QrCode } from "@/components/QrCode";
import { Barcode } from "@/components/Barcode";
import { AiIssueAssist } from "@/components/AiIssueAssist";
import { OtpDialog } from "@/components/OtpDialog";
import { CancelOtpDialog } from "@/components/CancelOtpDialog";
import { FileText, Star } from "lucide-react";
import { printInvoice, printLabels } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { useMe, useTeam } from "@/lib/auth";
import { trackUrl, useShipments } from "@/lib/shipments";
import { selectCls } from "@/lib/ui";
import { STATUS_META, fmtDate, inr, nextStatus, type Shipment, type ShipmentStatus } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/shipments/$id")({
  head: () => pageHead("Shipment", "Shipment details and QR label"),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { role, user } = useMe();
  useShipments(); // live updates
  const { data: team = [] } = useTeam();
  const [busy, setBusy] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const lots = useQuery({ queryKey: ["lots"], queryFn: async () => (await supabase.from("lots").select("id, code, name").order("created_at", { ascending: false })).data ?? [] });

  const q = useQuery({
    queryKey: ["shipment", id],
    queryFn: async () => {
      const [{ data: s, error }, { data: ev }] = await Promise.all([
        supabase.from("shipments").select("*").eq("id", id).maybeSingle(),
        supabase.from("shipment_events").select("*").eq("shipment_id", id).order("created_at", { ascending: false }),
      ]);
      if (error) throw error;
      return { s: s as Shipment | null, events: ev ?? [] };
    },
  });
  const s = q.data?.s;
  const names = new Map(team.map((t) => [t.id, t.full_name]));

  async function update(patch: Partial<Shipment>, msg: string) {
    setBusy(true);
    const { error } = await supabase.from("shipments").update(patch).eq("id", id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["shipment", id] });
    qc.invalidateQueries({ queryKey: ["shipments"] });
  }

  async function printLabel() {
    if (!s) return;
    try { await printLabels([s]); } catch (e) { toast.error(e instanceof Error ? e.message : "Print failed"); }
  }

  async function duplicate() {
    const n = Number(prompt("How many copies of this order?", "10"));
    if (!n || n < 1) return;
    const { data, error } = await supabase.rpc("duplicate_shipment", { _id: id, _copies: Math.min(n, 1000) });
    if (error) { toast.error(error.message); return; }
    toast.success(`${data} copies created, each with its own barcode`);
    qc.invalidateQueries({ queryKey: ["shipments"] });
  }

  async function requestReturn(kind: "customer_return" | "rto" | "cancellation") {
    const reason = prompt(kind === "cancellation" ? "Why is this parcel being cancelled?" : "Reason for return pickup?", "");
    if (!reason || reason.trim().length < 2 || !user) return;
    const { error } = await supabase.from("return_requests").insert({ shipment_id: id, kind, reason: reason.trim().slice(0, 500), created_by: user.id, rider_id: s?.rider_id ?? null });
    if (error) { toast.error(error.message); return; }
    toast.success(kind === "cancellation" ? "Parcel cancelled — return to hub is being tracked" : "Return pickup created");
    navigate({ to: "/returns" });
  }

  if (q.isLoading) return <AppShell title="Shipment"><div className="grid place-items-center py-24"><Loader2 className="animate-spin" /></div></AppShell>;
  if (!s) return <AppShell title="Shipment"><div className="py-24 text-center"><p className="font-semibold">Shipment not found or not in your team.</p><Link to="/shipments" className="text-primary">Back to shipments</Link></div></AppShell>;

  const next = nextStatus(s.status);
  const isRider = role === "rider";
  const closed = ["delivered", "failed", "returned", "cancelled"].includes(s.status);
  const riders = team.filter((t) => t.role === "rider");

  return (
    <AppShell
      title={s.tracking_code}
      actions={<Button variant="outline" size="sm" onClick={printLabel}><Printer /> <span className="hidden sm:inline">Print label</span></Button>}
    >
      <Link to="/shipments" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Shipments</Link>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-lg border bg-card p-5 shadow-card">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Receiver</p>
                <p className="truncate text-xl font-bold">{s.receiver_name}</p>
              </div>
              <StatusBadge status={s.status} />
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <a href={`tel:${s.receiver_phone}`} className="flex items-center gap-2 text-primary"><Phone className="h-4 w-4" /> {s.receiver_phone}</a>
              <a href={`https://maps.google.com/?q=${encodeURIComponent(`${s.receiver_address}, ${s.city} ${s.pincode ?? ""}`)}`} target="_blank" rel="noreferrer" className="flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-coral" /> {s.receiver_address}, {s.city} {s.pincode}</a>
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 text-sm sm:grid-cols-4">
              <Info k="COD" v={<span className="tabular">{inr(Number(s.cod_amount))}{Number(s.cod_amount) > 0 && (s.cod_collected ? " ✓" : "")}</span>} />
              <Info k="Weight" v={`${s.weight_kg} kg`} />
              <Info k="Sender" v={s.sender_name} />
              <Info k="Created" v={fmtDate(s.created_at)} />
              <Info k="Distributor" v={s.distributor_id ? names.get(s.distributor_id) ?? "—" : "—"} />
              <Info k="Manager" v={s.manager_id ? names.get(s.manager_id) ?? "—" : "—"} />
              <Info k="Rider" v={s.rider_id ? names.get(s.rider_id) ?? "—" : "Unassigned"} />
              <Info k="Delivered" v={fmtDate(s.delivered_at)} />
            </dl>
            {s.notes && <p className="mt-4 rounded-lg bg-muted p-3 text-sm">{s.notes}</p>}
          </section>

          {role !== "rider" && <AiIssueAssist shipmentId={s.id} />}

          <section className="rounded-lg border bg-card p-5 shadow-card">
            <h2 className="font-bold">Actions</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {next && next !== "assigned" && !closed && (
                next === "delivered" ? (
                  <Button variant="hero" disabled={busy} onClick={() => setOtpOpen(true)}><ShieldCheck /> Deliver with OTP</Button>
                ) : (
                  <Button variant="hero" disabled={busy} onClick={() => update({ status: next }, `Marked ${STATUS_META[next].label}`)}>
                    Mark {STATUS_META[next].label} <ChevronRight />
                  </Button>
                )
              )}
              {!closed && s.status !== "created" && (
                <Button variant="outline" disabled={busy} onClick={() => update({ status: "failed" }, "Marked failed")}><XCircle /> Failed attempt</Button>
              )}
              {s.status === "failed" && (
                <>
                  <Button variant="outline" disabled={busy} onClick={() => update({ status: "out_for_delivery" }, "Retry scheduled")}>Retry delivery</Button>
                  <Button variant="outline" disabled={busy} onClick={() => update({ status: "returned" }, "Marked returned")}><Undo2 /> Return to sender</Button>
                </>
              )}
              {s.status === "delivered" && Number(s.cod_amount) > 0 && !s.cod_collected && (
                <Button variant="coral" disabled={busy} onClick={() => update({ cod_collected: true }, "COD collected")}><IndianRupee /> COD collected</Button>
              )}
              {!isRider && <Button variant="outline" disabled={busy} onClick={duplicate}><Copy /> Copies</Button>}
              {["delivered", "failed"].includes(s.status) && <Button variant="outline" disabled={busy} onClick={() => requestReturn(s.status === "failed" ? "rto" : "customer_return")}><Undo2 /> Request return pickup</Button>}
              {!["delivered", "returned", "cancelled"].includes(s.status) && <Button variant="outline" className="text-destructive" disabled={busy} onClick={() => setCancelOpen(true)}><XCircle /> Cancel with customer OTP</Button>}
              <Button variant="outline" onClick={() => printInvoice(s).catch((e) => toast.error(e.message))}><FileText /> Print bill</Button>
              {!isRider && s.rider_id && s.status === "delivered" && (
                <Button variant="outline" disabled={busy} onClick={async () => {
                  const n = Number(prompt("Rate the rider for this delivery (1-5)", "5"));
                  if (!n || n < 1 || n > 5 || !user) return;
                  const { error } = await supabase.from("rider_ratings").insert({ rider_id: s.rider_id!, shipment_id: s.id, rating: Math.round(n), rated_by: user.id });
                  if (error) toast.error(error.code === "23505" ? "Already rated" : error.message); else toast.success("Rating saved");
                }}><Star /> Rate rider</Button>
              )}
              {(role === "admin" || (s.created_by === user?.id && s.status === "created")) && (
                <Button
                  variant="ghost"
                  className="text-destructive"
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm("Delete this shipment?")) return;
                    const { error } = await supabase.from("shipments").delete().eq("id", id);
                    if (error) { toast.error(error.message); return; }
                    toast.success("Deleted");
                    navigate({ to: "/shipments" });
                  }}
                ><Trash2 /> Delete</Button>
              )}
            </div>
            {!isRider && !closed && (
              <div className="mt-5 max-w-sm space-y-1.5">
                <p className="text-sm font-medium">Assign rider</p>
                <select
                  className={selectCls}
                  value={s.rider_id ?? ""}
                  disabled={busy}
                  onChange={(e) => update({ rider_id: e.target.value || null }, e.target.value ? "Rider assigned" : "Rider removed")}
                >
                  <option value="">Unassigned</option>
                  {riders.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
                </select>
                {riders.length === 0 && <p className="text-xs text-muted-foreground">No riders yet — add them on the Team page.</p>}
                <p className="pt-3 text-sm font-medium">Lot</p>
                <select className={selectCls} value={s.lot_id ?? ""} disabled={busy} onChange={(e) => update({ lot_id: e.target.value || null }, "Lot updated")}>
                  <option value="">No lot</option>
                  {(lots.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.code} {l.name && `· ${l.name}`}</option>)}
                </select>
              </div>
            )}
          </section>

          <section className="rounded-lg border bg-card p-5 shadow-card">
            <h2 className="font-bold">Timeline</h2>
            <ol className="relative mt-4 space-y-4 border-l pl-5">
              {q.data?.events.map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[26px] top-1 h-3 w-3 rounded-full bg-gradient-brand ring-4 ring-card" />
                  <p className="text-sm font-semibold">{e.note ?? STATUS_META[e.status as ShipmentStatus].label}</p>
                  <p className="text-xs text-muted-foreground">{fmtDate(e.created_at)}{e.actor_id && names.get(e.actor_id) ? ` · by ${names.get(e.actor_id)}` : ""}</p>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <aside className="h-fit rounded-lg border bg-card p-5 text-center shadow-card">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">QR & barcode label</p>
          <div className="mx-auto mt-3 w-fit rounded-md border p-3"><QrCode value={trackUrl(s.tracking_code)} size={200} /></div>
          <div className="mt-4 rounded-md border bg-background p-3"><Barcode value={s.tracking_code} /></div>
          <p className="mt-2 font-mono text-lg font-bold">{s.tracking_code}</p>
          <p className="break-all text-[11px] text-muted-foreground">Order ID {s.id}</p>
          {s.is_demo && <span className="mt-2 inline-block rounded-full bg-warning/30 px-2 py-0.5 text-xs font-semibold">Demo order</span>}
          <p className="text-xs text-muted-foreground">Scan in the app to update status, or by the customer to track.</p>
          <Button className="mt-4 w-full" variant="hero" onClick={printLabel}><Printer /> Print label</Button>
        </aside>
      </div>
      <OtpDialog shipment={otpOpen ? s : null} onClose={() => setOtpOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ["shipment", id] }); qc.invalidateQueries({ queryKey: ["shipments"] }); }} />
      <CancelOtpDialog shipment={cancelOpen ? s : null} onClose={() => setCancelOpen(false)} onDone={() => { qc.invalidateQueries({ queryKey: ["shipment", id] }); qc.invalidateQueries({ queryKey: ["shipments"] }); }} />
    </AppShell>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{k}</dt><dd className="truncate font-medium">{v}</dd></div>;
}
