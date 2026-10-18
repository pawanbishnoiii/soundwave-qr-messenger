import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { formatDistanceToNow } from "date-fns";
import {
  Home, ScanLine, Route as RouteIcon, Wallet, UserRound, Phone, Navigation, CheckCircle2, XCircle, Ban, PackagePlus,
  IndianRupee, Star, Target, Package, X, LogOut, Banknote, Keyboard, ChevronRight, Clock, MapPin,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { QrScanner } from "@/components/QrScanner";
import { OtpDialog } from "@/components/OtpDialog";
import { CancelOtpDialog } from "@/components/CancelOtpDialog";
import { useMe } from "@/lib/auth";
import { useShipments, parseScanned } from "@/lib/shipments";
import { riderStats, useRatings, useWalletTxns } from "@/lib/rider";
import { STATUS_META, inr, type Shipment } from "@/lib/status";
import { playError, playSuccess, unlockAudio } from "@/lib/sound";
import { pageHead } from "@/lib/seo";
import riderArt from "@/assets/rider-hero.png";
import { captureScanLocation } from "@/lib/location";
import { CashCard } from "@/components/rider/RiderCash";
import { StorePickupCard } from "@/components/rider/StorePickup";

export const Route = createFileRoute("/_authenticated/rider")({
  head: () => pageHead("Rider app", "Your deliveries, scanner, route and wallet"),
  component: RiderApp,
});

type Tab = "today" | "scan" | "route" | "wallet" | "profile";
const OPEN = ["assigned", "picked_up", "hub_received", "sorted", "in_transit", "out_for_delivery", "reattempt", "failed"];
const FAIL_REASONS = ["Customer not available", "Wrong address", "Customer refused", "Phone switched off", "Premises closed", "Asked to reschedule"];

function RiderApp() {
  const { user, profile } = useMe();
  const { data: ships = [] } = useShipments();
  const { data: txns = [] } = useWalletTxns();
  const { data: ratings = [] } = useRatings();
  const [tab, setTab] = useState<Tab>("today");
  const [card, setCard] = useState<Shipment | null>(null);
  const uid = user?.id ?? "";
  const mine = useMemo(() => ships.filter((s) => s.rider_id === uid), [ships, uid]);
  const stats = riderStats(uid, ships, txns, ratings);
  const route = mine.filter((s) => OPEN.includes(s.status)).sort((a, b) => (a.route_seq ?? 999) - (b.route_seq ?? 999));
  const live = card ? ships.find((s) => s.id === card.id) ?? card : null;

  const TABS: { id: Tab; label: string; icon: typeof Home }[] = [
    { id: "today", label: "Today", icon: Home }, { id: "route", label: "Route", icon: RouteIcon },
    { id: "scan", label: "Scan", icon: ScanLine }, { id: "wallet", label: "Wallet", icon: Wallet }, { id: "profile", label: "Me", icon: UserRound },
  ];

  return (
    <div className="rider-app min-h-dvh">
      <div className="mx-auto min-h-dvh max-w-md pb-28 sm:border-x sm:border-border">
        {tab === "today" && <Today uid={uid} name={profile?.full_name?.split(" ")[0] ?? "Rider"} stats={stats} route={route} onOpen={setCard} goScan={() => setTab("scan")} />}
        {tab === "route" && <RouteTab route={route} onOpen={setCard} />}
        {tab === "scan" && <ScanTab mine={mine} all={ships} onFound={(s) => { setCard(s); setTab("route"); }} />}
        {tab === "wallet" && <WalletTab uid={uid} txns={txns.filter((t) => t.rider_id === uid)} stats={stats} />}
        {tab === "profile" && <ProfileTab name={profile?.full_name ?? ""} phone={profile?.phone ?? ""} stats={stats} />}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto mb-3 grid max-w-md grid-cols-5 items-end rounded-3xl border border-border bg-card/95 px-2 py-2 shadow-2xl backdrop-blur sm:mb-4">
          {TABS.map((t) => t.id === "scan" ? (
            <button key={t.id} onClick={() => { unlockAudio(); setTab("scan"); }} aria-label="Scan" className="mx-auto -mt-8 grid h-16 w-16 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-90">
              <ScanLine className="h-7 w-7" />
            </button>
          ) : (
            <button key={t.id} onClick={() => setTab(t.id)} className={`flex flex-col items-center gap-1 rounded-2xl py-1.5 text-[11px] font-medium transition-colors ${tab === t.id ? "text-primary" : "text-muted-foreground"}`}>
              <t.icon className="h-5 w-5" />{t.label}
            </button>
          ))}
        </div>
      </nav>

      {live && <ParcelSheet s={live} onClose={() => setCard(null)} />}
    </div>
  );
}

type Stats = ReturnType<typeof riderStats>;

function Today({ uid, name, stats, route, onOpen, goScan }: { uid: string; name: string; stats: Stats; route: Shipment[]; onOpen: (s: Shipment) => void; goScan: () => void }) {
  const next = route.find((s) => s.status === "out_for_delivery") ?? route[0];
  const tiles = [
    { label: "To deliver", value: stats.pending, icon: Package },
    { label: "Delivered today", value: stats.deliveredToday, icon: CheckCircle2 },
    { label: "Earned today", value: inr(stats.earnedToday), icon: IndianRupee },
    { label: "Rating", value: stats.rating ? stats.rating.toFixed(1) : "–", icon: Star },
  ];
  return (
    <div className="space-y-5 p-4">
      <header className="relative overflow-hidden rounded-3xl bg-primary p-5 text-primary-foreground">
        <p className="text-sm font-medium opacity-80">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}</p>
        <h1 className="mt-1 text-2xl font-extrabold leading-tight">Hi {name},<br />ready to ride?</h1>
        <p className="mt-2 text-sm opacity-80">{stats.accuracyToday != null ? `${stats.accuracyToday}% success today` : "No deliveries closed yet today"}</p>
        <img src={riderArt} alt="" width={1024} height={768} className="pointer-events-none absolute -bottom-4 -right-8 w-44" />
      </header>
      <DayProgress done={stats.deliveredToday} left={route.filter((r) => r.status === "out_for_delivery").length} load={route.filter((r) => r.status !== "out_for_delivery").length} />
      <div className="grid grid-cols-2 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-border bg-card p-4">
            <t.icon className="h-5 w-5 text-primary" />
            <p className="mt-3 text-2xl font-bold tabular">{t.value}</p>
            <p className="text-xs text-muted-foreground">{t.label}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StorePickupCard />
        <button onClick={goScan} className="flex h-32 flex-col justify-center rounded-3xl border border-border bg-card p-5 text-left transition-transform active:scale-[0.98]">
          <ScanLine className="h-6 w-6 text-primary" /><p className="mt-2 text-lg font-bold">Quick scan</p><p className="text-xs text-muted-foreground">Open any parcel</p>
        </button>
      </div>
      {uid && <CashCard uid={uid} />}
      {next ? (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">Next stop</h2>
          <StopCard s={next} onOpen={onOpen} big />
        </section>
      ) : (
        <button onClick={goScan} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-5 text-left">
          <ScanLine className="h-8 w-8 text-primary" /><div><p className="font-semibold">No parcels yet</p><p className="text-sm text-muted-foreground">Scan a parcel at the hub to add it to your bucket.</p></div>
        </button>
      )}
    </div>
  );
}

function DayProgress({ done, left, load }: { done: number; left: number; load: number }) {
  const total = done + left + load; const pct = total ? Math.round((done / total) * 100) : 0; const C = 2 * Math.PI * 34;
  const steps = [
    { t: "Load parcels at store", sub: load ? `${load} waiting to scan` : "All loaded", ok: load === 0 },
    { t: "Deliver with customer OTP", sub: left ? `${left} in your bucket` : "Bucket clear", ok: left === 0 && done > 0 },
    { t: "Hand over cash at store", sub: "Staff tells you the code", ok: false },
  ];
  return (
    <section className="flex items-center gap-4 rounded-3xl border border-border bg-card p-4">
      <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0 -rotate-90" aria-label={`${pct}% of today's parcels done`}>
        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--muted)" strokeWidth="8" />
        <circle cx="40" cy="40" r="34" fill="none" stroke="var(--primary)" strokeWidth="8" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C - (C * pct) / 100} style={{ transition: "stroke-dashoffset 1s ease" }} />
        <text x="40" y="46" textAnchor="middle" className="rotate-90 fill-foreground text-lg font-bold" transform="rotate(90 40 40)">{pct}%</text>
      </svg>
      <ol className="flex-1 space-y-2">
        {steps.map((st, i) => (
          <li key={st.t} className="flex items-start gap-2">
            <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${st.ok ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>{st.ok ? "✓" : i + 1}</span>
            <span><span className="block text-sm font-semibold leading-tight">{st.t}</span><span className="text-xs text-muted-foreground">{st.sub}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StopCard({ s, onOpen, idx, big }: { s: Shipment; onOpen: (s: Shipment) => void; idx?: number; big?: boolean }) {
  const ofd = s.status === "out_for_delivery";
  return (
    <button onClick={() => onOpen(s)} className={`flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition-transform active:scale-[0.98] ${ofd ? "border-primary/60" : "border-border"}`}>
      {idx != null && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary text-sm font-bold">{idx}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`truncate font-semibold ${big ? "text-lg" : ""}`}>{s.receiver_name}</p>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${ofd ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{STATUS_META[s.status].label}</span>
        </div>
        <p className="truncate text-sm text-muted-foreground"><MapPin className="mr-1 inline h-3 w-3" />{s.receiver_address}, {s.city}</p>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{s.tracking_code}{Number(s.cod_amount) > 0 && <span className="ml-2 font-sans font-semibold text-primary">COD {inr(Number(s.cod_amount))}</span>}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </button>
  );
}

function RouteTab({ route, onOpen }: { route: Shipment[]; onOpen: (s: Shipment) => void }) {
  const [f, setF] = useState<"all" | "ofd" | "pending">("all");
  const list = route.filter((s) => f === "all" || (f === "ofd" ? s.status === "out_for_delivery" : s.status !== "out_for_delivery"));
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-extrabold">My route</h1>
      <div className="flex gap-2">
        {([["all", "All"], ["ofd", "In bucket"], ["pending", "To pick"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setF(k)} className={`rounded-full px-4 py-1.5 text-sm font-medium ${f === k ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{l}</button>
        ))}
      </div>
      {list.length ? <div className="space-y-2">{list.map((s, i) => <StopCard key={s.id} s={s} idx={i + 1} onOpen={onOpen} />)}</div>
        : <p className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">Nothing here right now.</p>}
    </div>
  );
}

function ScanTab({ mine, all, onFound }: { mine: Shipment[]; all: Shipment[]; onFound: (s: Shipment) => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  async function handle(text: string) {
    if (busy) return;
    const code = parseScanned(text);
    setBusy(true);
    try { await captureScanLocation(); } catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Location required"); return; }
    const own = mine.find((s) => s.tracking_code.toUpperCase() === code);
    if (own) { playSuccess(); onFound(own); return; }
    const { data, error } = await supabase.rpc("claim_shipment", { _code: code });
    if (error || !data) { playError(); toast.error(error?.message ?? "Parcel not found"); setBusy(false); return; }
    playSuccess();
    toast.success(`${(data as Shipment).tracking_code} added to your parcels`);
    qc.invalidateQueries({ queryKey: ["shipments"] });
    onFound((all.find((s) => s.id === (data as Shipment).id) ?? data) as Shipment);
  }
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-extrabold">Scan parcel</h1>
      <p className="text-sm text-muted-foreground">Point at the barcode or QR. The parcel opens instantly and the camera closes.</p>
      {!busy && <QrScanner onScan={handle} />}
      <form onSubmit={(e) => { e.preventDefault(); if (typed.trim()) void handle(typed); }} className="flex gap-2">
        <div className="relative flex-1">
          <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type tracking code" className="h-12 w-full rounded-2xl border border-border bg-card pl-10 pr-3 font-mono uppercase outline-none focus:border-primary" />
        </div>
        <button className="h-12 rounded-2xl bg-primary px-5 font-semibold text-primary-foreground">Open</button>
      </form>
    </div>
  );
}

function ParcelSheet({ s, onClose }: { s: Shipment; onClose: () => void }) {
  const qc = useQueryClient();
  const [otpFor, setOtpFor] = useState<Shipment | null>(null);
  const [cancelFor, setCancelFor] = useState<Shipment | null>(null);
  const [failing, setFailing] = useState(false);
  const [busy, setBusy] = useState(false);
  const ofd = s.status === "out_for_delivery";
  const canCancel = ["assigned", "picked_up", "hub_received", "out_for_delivery", "failed", "reattempt"].includes(s.status);

  async function move(to: "out_for_delivery" | "failed", failure?: string) {
    setBusy(true);
    let fix;
    try { fix = await captureScanLocation(); } catch (error) { setBusy(false); toast.error(error instanceof Error ? error.message : "Location required"); return; }
    const { error } = await supabase.rpc("scan_transition", { _code: s.tracking_code, _to: to, _source: "rider_app", _lat: fix.lat, _lng: fix.lng, ...(failure ? { _failure: failure } : {}) });
    setBusy(false);
    if (error) { playError(); toast.error(error.message); return; }
    playSuccess(); setFailing(false);
    toast.success(to === "failed" ? "Marked as failed attempt" : "Added to your delivery bucket");
    qc.invalidateQueries({ queryKey: ["shipments"] });
  }
  const btn = "flex h-14 items-center justify-center gap-2 rounded-2xl font-semibold transition-transform active:scale-95 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[90dvh] max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pb-8 animate-sheet-up">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-sm text-muted-foreground">{s.tracking_code}</p>
            <h2 className="truncate text-2xl font-extrabold">{s.receiver_name}</h2>
            <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">{STATUS_META[s.status].label}</span>
          </div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-2 rounded-2xl bg-secondary p-4 text-sm">
          <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" />{s.receiver_address}, {s.city} {s.pincode}</p>
          <p className="flex gap-2"><Package className="h-4 w-4 shrink-0 text-primary" />{s.weight_kg} kg · {s.package_type}{s.fragile ? " · Fragile" : ""}</p>
          <p className="flex gap-2"><IndianRupee className="h-4 w-4 shrink-0 text-primary" />{Number(s.cod_amount) > 0 ? `Collect ${inr(Number(s.cod_amount))} cash` : "Prepaid — no cash"}</p>
          {s.promised_by && <p className="flex gap-2"><Clock className="h-4 w-4 shrink-0 text-primary" />Due {formatDistanceToNow(new Date(s.promised_by), { addSuffix: true })}</p>}
          {s.attempt_count > 0 && <p className="text-warning">Attempt #{s.attempt_count + 1}{s.failure_reason ? ` · last: ${s.failure_reason}` : ""}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`tel:${s.receiver_phone}`} className={`${btn} bg-secondary`}><Phone className="h-5 w-5" /> Call</a>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${s.receiver_address}, ${s.city} ${s.pincode ?? ""}`)}`} target="_blank" rel="noreferrer" className={`${btn} bg-secondary`}><Navigation className="h-5 w-5" /> Navigate</a>
          {ofd ? (
            <button onClick={() => setOtpFor(s)} className={`${btn} col-span-2 bg-primary text-primary-foreground`}><CheckCircle2 className="h-5 w-5" /> Deliver with OTP</button>
          ) : ["assigned", "picked_up", "hub_received", "sorted", "in_transit", "reattempt", "failed"].includes(s.status) ? (
            <button disabled={busy} onClick={() => move("out_for_delivery")} className={`${btn} col-span-2 bg-primary text-primary-foreground`}><PackagePlus className="h-5 w-5" /> Start delivery (add to bucket)</button>
          ) : null}
          {ofd && <button onClick={() => setFailing((v) => !v)} className={`${btn} bg-secondary`}><XCircle className="h-5 w-5" /> Not delivered</button>}
          {canCancel && <button onClick={() => setCancelFor(s)} className={`${btn} bg-secondary text-destructive ${ofd ? "" : "col-span-2"}`}><Ban className="h-5 w-5" /> Cancel (OTP)</button>}
        </div>
        {failing && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {FAIL_REASONS.map((r) => <button key={r} disabled={busy} onClick={() => move("failed", r)} className="rounded-xl border border-border p-3 text-left text-sm active:bg-secondary">{r}</button>)}
          </div>
        )}
        {!ofd && <p className="mt-3 text-center text-xs text-muted-foreground">Returns are only possible after a delivery attempt.</p>}
      </div>
      <OtpDialog shipment={otpFor} onClose={() => setOtpFor(null)} onDone={() => {
        setOtpFor(null); confetti({ particleCount: 120, spread: 70, origin: { y: 0.7 } });
        qc.invalidateQueries({ queryKey: ["shipments"] }); qc.invalidateQueries({ queryKey: ["wallet"] }); onClose();
      }} />
      <CancelOtpDialog shipment={cancelFor} onClose={() => setCancelFor(null)} onDone={() => { setCancelFor(null); qc.invalidateQueries({ queryKey: ["shipments"] }); onClose(); }} />
    </div>
  );
}

function WalletTab({ uid, txns, stats }: { uid: string; txns: { id: string; amount: number; kind: string; note: string | null; created_at: string }[]; stats: Stats }) {
  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-extrabold">Wallet</h1>
      <div className="rounded-3xl bg-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-80">Total earned</p>
        <p className="text-4xl font-extrabold tabular">{inr(stats.wallet)}</p>
        <p className="mt-1 text-sm opacity-80">{inr(stats.earnedToday)} today</p>
      </div>
      <CashCard uid={uid} />
      <div className="divide-y divide-border rounded-2xl border border-border bg-card">
        {txns.length ? txns.slice(0, 50).map((t) => (
          <div key={t.id} className="flex items-center justify-between p-4">
            <div className="min-w-0"><p className="truncate text-sm font-medium">{t.note ?? t.kind}</p><p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(t.created_at), { addSuffix: true })}</p></div>
            <p className="font-semibold text-primary tabular">+{inr(Number(t.amount))}</p>
          </div>
        )) : <p className="p-8 text-center text-sm text-muted-foreground">Earnings appear after each delivery.</p>}
      </div>
    </div>
  );
}

function ProfileTab({ name, phone, stats }: { name: string; phone: string; stats: Stats }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  async function out() { qc.clear(); await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }
  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4 rounded-3xl border border-border bg-card p-5">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-primary text-2xl font-extrabold text-primary-foreground">{(name || "R").charAt(0)}</div>
        <div><p className="text-xl font-bold">{name || "Rider"}</p><p className="text-sm text-muted-foreground">{phone}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[{ l: "Delivered", v: stats.delivered, i: CheckCircle2 }, { l: "Accuracy", v: stats.accuracyToday != null ? `${stats.accuracyToday}%` : "–", i: Target }, { l: `${stats.ratingCount} ratings`, v: stats.rating ? stats.rating.toFixed(1) : "–", i: Star }].map((x) => (
          <div key={x.l} className="rounded-2xl border border-border bg-card p-3"><x.i className="mx-auto h-5 w-5 text-primary" /><p className="mt-1 text-lg font-bold">{x.v}</p><p className="text-[11px] text-muted-foreground">{x.l}</p></div>
        ))}
      </div>
      <button onClick={out} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-secondary font-semibold text-destructive"><LogOut className="h-5 w-5" /> Sign out</button>
    </div>
  );
}
