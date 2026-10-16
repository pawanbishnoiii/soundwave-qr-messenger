import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wallet, Star, Target, PackageCheck, Clock, ScanLine, Phone, MapPin, ShieldCheck, XCircle } from "lucide-react";
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
  if (!user) return null;
  const st = riderStats(user.id, rows, txns, ratings);
  const todo = rows.filter((s) => s.rider_id === user.id && ["assigned", "picked_up", "in_transit", "out_for_delivery"].includes(s.status));
  const refresh = () => { qc.invalidateQueries({ queryKey: ["shipments"] }); qc.invalidateQueries({ queryKey: ["wallet"] }); };

  const tiles = [
    { label: "To deliver", value: st.pending, icon: Clock },
    { label: "Delivered today", value: st.deliveredToday, icon: PackageCheck },
    { label: "Accuracy today", value: st.accuracyToday === null ? "—" : `${st.accuracyToday}%`, icon: Target },
    { label: `Rating (${st.ratingCount})`, value: st.rating === null ? "—" : st.rating.toFixed(1) + "★", icon: Star },
  ];

  return (
    <AppShell title={`Hi, ${profile?.full_name?.split(" ")[0] || "rider"}`} actions={<Button asChild variant="hero" size="sm"><Link to="/scan"><ScanLine /> Scan</Link></Button>}>
      <div className="mx-auto max-w-xl space-y-4">
        <section className="rounded-2xl bg-gradient-hero p-5 text-navy-foreground shadow-card">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm opacity-80"><Wallet className="h-4 w-4" /> Wallet balance</p>
          </div>
          <p className="mt-1 font-display text-4xl font-bold tabular">{inr(st.wallet)}</p>
          <p className="mt-1 text-sm opacity-80">Today +{inr(st.earnedToday)} · COD to hand over {inr(st.codPending)}</p>
        </section>

        <div className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border bg-card p-4 shadow-card">
              <t.icon className="h-5 w-5 text-primary" />
              <p className="mt-2 font-display text-2xl font-bold tabular">{t.value}</p>
              <p className="text-xs text-muted-foreground">{t.label}</p>
            </div>
          ))}
        </div>

        <section>
          <h2 className="mb-2 font-bold">My route ({todo.length})</h2>
          {todo.length === 0 && <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No parcels pending. Scan a label to pick one up.</p>}
          <ul className="space-y-3">
            {todo.map((s) => (
              <li key={s.id} className="rounded-xl border bg-card p-4 shadow-card">
                <Link to="/shipments/$id" params={{ id: s.id }} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{s.receiver_name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{s.tracking_code}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </Link>
                <p className="mt-2 flex items-start gap-1.5 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{s.receiver_address}, {s.city}</p>
                {Number(s.cod_amount) > 0 && <p className="mt-1 text-sm font-semibold text-coral">Collect {inr(Number(s.cod_amount))}</p>}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <Button asChild variant="outline" size="sm"><a href={`tel:${s.receiver_phone}`}><Phone /> Call</a></Button>
                  <Button variant="hero" size="sm" onClick={() => setDeliver(s)}><ShieldCheck /> Deliver</Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => setCancel(s)}><XCircle /> Cancel</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-card">
          <h2 className="font-bold">Wallet history</h2>
          <ul className="mt-2 divide-y text-sm">
            {txns.filter((t) => t.rider_id === user.id).slice(0, 10).map((t) => (
              <li key={t.id} className="flex justify-between py-2"><span>{t.note ?? t.kind}<br /><span className="text-xs text-muted-foreground">{fmtDate(t.created_at)}</span></span><span className="font-semibold text-success">+{inr(Number(t.amount))}</span></li>
            ))}
            {!txns.some((t) => t.rider_id === user.id) && <li className="py-3 text-muted-foreground">Deliver parcels to start earning — credits appear here automatically.</li>}
          </ul>
        </section>
      </div>
      <OtpDialog shipment={deliver} onClose={() => setDeliver(null)} onDone={refresh} />
      <CancelOtpDialog shipment={cancel} onClose={() => setCancel(null)} onDone={refresh} />
    </AppShell>
  );
}
