import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, Star, Target, PackageCheck, Clock, ScanLine, Phone, MapPin, ShieldCheck, XCircle, Navigation } from "lucide-react";
import { Reveal, CountUp } from "./motion";
import { AppShell } from "./AppShell";
import { StatusBadge } from "./StatusBadge";
import { OtpDialog } from "./OtpDialog";
import { CancelOtpDialog } from "./CancelOtpDialog";
import { Button } from "./ui/button";
import { useMe } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { riderStats, useRatings, useWalletTxns } from "@/lib/rider";
import { fmtDate, inr, type Shipment } from "@/lib/status";

/** App-style home for riders: today's work, wallet, rating and accuracy. */
export function RiderHome() {
  const { user, profile } = useMe();
  const qc = useQueryClient();
  const { data: rows = [] } = useShipments();
  const { data: txns = [] } = useWalletTxns();
  const { data: ratings = [] } = useRatings();
  const [deliver, setDeliver] = useState<Shipment | null>(null);
  const [cancel, setCancel] = useState<Shipment | null>(null);
  const [tab, setTab] = useState<"todo" | "done">("todo");
  const [open, setOpen] = useState<string | null>(null);
  if (!user) return null;
  const st = riderStats(user.id, rows, txns, ratings);
  const todo = rows.filter((s) => s.rider_id === user.id && ["assigned", "picked_up", "in_transit", "out_for_delivery"].includes(s.status));
  const refresh = () => { qc.invalidateQueries({ queryKey: ["shipments"] }); qc.invalidateQueries({ queryKey: ["wallet"] }); };

  const tiles = [
        { label: "Done", value: st.pending === 0 ? st.deliveredToday : st.deliveredToday, icon: Clock },
    { label: "Delivered today", value: st.deliveredToday, icon: PackageCheck },
    { label: "Accuracy today", value: st.accuracyToday === null ? "—" : `${st.accuracyToday}%`, icon: Target },
    { label: `Rating (${st.ratingCount})`, value: st.rating === null ? "—" : st.rating.toFixed(1) + "★", icon: Star },
  ];

  const done = rows.filter((s) => s.rider_id === user.id && ["delivered", "failed", "returned", "cancelled"].includes(s.status) && new Date(s.updated_at).toDateString() === new Date().toDateString());
  const list = tab === "todo" ? todo : done;
  const ordered = [...list].sort((a, b) => (a.route_seq ?? 999) - (b.route_seq ?? 999));

  return (
    <AppShell title={`Hi, ${profile?.full_name?.split(" ")[0] || "rider"}`} actions={<Button asChild variant="hero" size="sm"><Link to="/scan"><ScanLine /> Scan</Link></Button>}>
      <div className="mx-auto max-w-xl space-y-4 pb-24">
        <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-hero p-5 text-navy-foreground shadow-card" y={20}>
          <div data-reveal className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] opacity-70">You have deliveries</p>
              <p className="mt-1 font-display text-4xl font-bold"><CountUp value={todo.length} /> <span className="text-lg font-medium opacity-80">to go</span></p>
            </div>
            <div className="rounded-2xl bg-navy-foreground/10 px-3 py-2 text-right">
              <p className="flex items-center justify-end gap-1 text-[11px] opacity-75"><Wallet className="h-3 w-3" /> Wallet</p>
              <p className="font-display text-lg font-bold tabular">{inr(st.wallet)}</p>
            </div>
          </div>
          <div data-reveal className="mt-4 grid grid-cols-4 gap-2 text-center">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-xl bg-navy-foreground/10 p-2">
                <t.icon className="mx-auto h-4 w-4 text-lime" />
                <p className="mt-1 font-display text-base font-bold tabular">{t.value}</p>
                <p className="text-[10px] leading-tight opacity-70">{t.label}</p>
              </div>
            ))}
          </div>
          {st.codPending > 0 && <Link data-reveal to="/cash" className="mt-3 flex items-center justify-between rounded-xl bg-lime px-3 py-2 text-sm font-semibold text-navy">Cash in hand {inr(st.codPending)} <span>Hand over →</span></Link>}
        </Reveal>

        <div role="tablist" className="grid grid-cols-2 rounded-full border bg-card p-1 text-sm font-semibold">
          {(["todo", "done"] as const).map((k) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={`rounded-full py-2 transition-colors ${tab === k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {k === "todo" ? `My route (${todo.length})` : `Done today (${done.length})`}
            </button>
          ))}
        </div>

        {ordered.length === 0 && <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">{tab === "todo" ? "No parcels pending. Scan a label to pick one up." : "Nothing closed yet today."}</p>}
        <Reveal as="ul" className="space-y-3" stagger={0.05}>
          {ordered.map((s, i) => {
            const isOpen = open === s.id;
            return (
              <li key={s.id} data-reveal className={`overflow-hidden rounded-2xl border bg-card shadow-card transition-all ${isOpen ? "ring-2 ring-primary" : ""}`}>
                <button className="flex w-full items-start gap-3 p-4 text-left" onClick={() => setOpen(isOpen ? null : s.id)}>
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 font-display font-bold text-primary">#{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-semibold">{s.receiver_name}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-0.5 flex items-start gap-1 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span className="line-clamp-2">{s.receiver_address}, {s.city}</span></p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                      <span className="rounded-full bg-muted px-2 py-0.5 font-mono">{s.tracking_code}</span>
                      {Number(s.cod_amount) > 0 ? <span className="rounded-full bg-coral/15 px-2 py-0.5 text-coral">COD {inr(Number(s.cod_amount))}</span> : <span className="rounded-full bg-success/15 px-2 py-0.5 text-success">Prepaid</span>}
                      {s.attempt_count > 0 && <span className="rounded-full bg-accent px-2 py-0.5 text-primary">Attempt {s.attempt_count + 1}</span>}
                    </div>
                  </div>
                </button>
                {isOpen && tab === "todo" && (
                  <div className="grid grid-cols-2 gap-2 border-t bg-muted/30 p-3">
                    <Button asChild variant="outline" size="sm"><a href={`tel:${s.receiver_phone}`}><Phone /> Call</a></Button>
                    <Button asChild variant="outline" size="sm"><a target="_blank" rel="noreferrer" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.receiver_address}, ${s.city} ${s.pincode ?? ""}`)}`}><Navigation /> Navigate</a></Button>
                    <Button variant="outline" size="sm" className="border-destructive/40 text-destructive" onClick={() => setCancel(s)}><XCircle /> Not delivered</Button>
                    <Button size="sm" className="bg-success text-success-foreground hover:bg-success/90" onClick={() => setDeliver(s)}><ShieldCheck /> Delivered</Button>
                    <Button asChild variant="ghost" size="sm" className="col-span-2"><Link to="/shipments/$id" params={{ id: s.id }}>Full details</Link></Button>
                  </div>
                )}
              </li>
            );
          })}
        </Reveal>

        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <h2 className="font-bold">Earnings</h2>
          <ul className="mt-2 divide-y text-sm">
            {txns.filter((t) => t.rider_id === user.id).slice(0, 8).map((t) => (
              <li key={t.id} className="flex justify-between py-2"><span>{t.note ?? t.kind}<br /><span className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</span></span><span className="font-semibold text-success">+{inr(Number(t.amount))}</span></li>
            ))}
            {!txns.some((t) => t.rider_id === user.id) && <li className="py-3 text-muted-foreground">Deliver parcels to start earning — credits appear here automatically.</li>}
          </ul>
        </section>
      </div>
      <Link to="/scan" aria-label="Scan parcel" className="fixed bottom-6 right-6 z-30 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-card lg:hidden"><ScanLine className="h-7 w-7" /></Link>
      <OtpDialog shipment={deliver} onClose={() => setDeliver(null)} onDone={refresh} />
      <CancelOtpDialog shipment={cancel} onClose={() => setCancel(null)} onDone={refresh} />
    </AppShell>
  );
}
