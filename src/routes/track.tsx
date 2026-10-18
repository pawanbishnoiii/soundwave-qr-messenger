import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useMemo, useState } from "react";
import { ClientOnly, Link } from "@tanstack/react-router";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, Circle, Search, ShieldCheck, Loader2, MapPin, ArrowLeft, Package, Truck, Copy, Clock, Headphones } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PublicShell } from "@/components/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { Reveal } from "@/components/motion";
import { STATUS_FLOW, STATUS_META, fmtDate, inr, type ShipmentStatus } from "@/lib/status";
const TrackMap = lazy(() => import("@/components/TrackMap"));
import trackHero from "@/assets/bnoy-handover.webp";

type Tracked = {
  tracking_code: string; status: ShipmentStatus; city: string; receiver: string; receiver_address?: string; cod_amount?: number;
  created_at: string; updated_at: string; delivered_at: string | null; promised_by: string | null;
  events: { status: ShipmentStatus; at: string; hub: string | null }[];
};

export const Route = createFileRoute("/track")({
  validateSearch: z.object({ code: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Track your parcel securely — Bnoy Logistics OS" },
      { name: "description", content: "Enter your tracking number and verify with a one-time code sent to your phone to see your parcel's journey." },
      { property: "og:title", content: "Track your parcel securely — Bnoy Logistics OS" },
      { property: "og:description", content: "OTP-verified parcel tracking from pickup to doorstep." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrackPage,
});

function TrackPage() {
  const { code: initial } = Route.useSearch();
  const [step, setStep] = useState<"code" | "otp" | "done">("code");
  const [code, setCode] = useState(initial ?? "");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [demo, setDemo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [t, setT] = useState<Tracked | null>(null);

  async function requestOtp(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("request_tracking_otp", { _code: code.trim(), _phone_last4: phone });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const d = data as { sent_to: string; sms_configured: boolean; demo_code: string | null };
    setSentTo(d.sent_to); setDemo(d.demo_code); setOtp(""); setStep("otp");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.rpc("track_with_otp", { _code: code.trim(), _otp: otp });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setT(data as unknown as Tracked); setStep("done");
  }
  const reached = new Map(t?.events.map((e) => [e.status, e]) ?? []);
  const stops = useMemo(() => t ? [...t.events.filter((e) => e.hub).map((e) => ({ label: `${STATUS_META[e.status].label} · ${e.hub}`, query: `${e.hub}, India`, done: true })), { label: `Destination · ${t.city}`, query: `${t.city}, India`, done: t.status === "delivered" }] : [], [t]);
  const progress = t ? Math.round(((STATUS_FLOW.indexOf(t.status) + 1) / STATUS_FLOW.length) * 100) : 0;

  return (
    <PublicShell>
      <section className="relative isolate overflow-hidden bg-navy text-navy-foreground">
        <img src={trackHero} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover object-center opacity-30" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-navy via-navy/90 to-navy/60" />
        <div className={`public-container grid gap-10 py-12 sm:py-16 ${step === "done" ? "" : "lg:grid-cols-[1fr_minmax(0,460px)] lg:items-center"}`}>
          <Reveal className="max-w-xl">
            <p data-reveal className="inline-flex items-center gap-2 rounded-full border border-navy-foreground/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-lime"><ShieldCheck className="h-3.5 w-3.5" /> Secure tracking</p>
            <h1 data-reveal className="mt-4 font-display text-4xl font-bold sm:text-6xl">Where's my parcel?</h1>
            <p data-reveal className="mt-3 text-sm text-navy-foreground/80 sm:text-base">Enter your tracking number, confirm with a one-time code, and follow every step from pickup to your door.</p>
            <div data-reveal className="mt-8 grid max-w-md grid-cols-3 gap-3">
              {[{ i: Search, t: "Enter code" }, { i: ShieldCheck, t: "Verify OTP" }, { i: Truck, t: "Live journey" }].map(({ i: I, t: l }, n) => (
                <div key={l} className={`rounded-2xl border p-3 backdrop-blur ${["code", "otp", "done"].indexOf(step) >= n ? "border-lime/50 bg-lime/10" : "border-navy-foreground/15 bg-navy-foreground/5"}`}>
                  <I className="h-5 w-5 text-lime" /><p className="mt-2 text-xs font-semibold">{l}</p>
                </div>
              ))}
            </div>
          </Reveal>
          {step !== "done" && (
        <div className="w-full rounded-2xl border bg-card p-6 text-card-foreground shadow-card sm:p-7">
          {step === "code" && (
            <form onSubmit={requestOtp} className="space-y-4">
              <div><Label htmlFor="code">Tracking number or order ID</Label>
                <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. BN261014ABCDE" className="h-12 font-mono uppercase" maxLength={80} required /></div>
              <div><Label htmlFor="ph">Last 4 digits of the receiver's phone</Label>
                <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="••••" className="h-12 tracking-[0.5em]" required minLength={4} /></div>
              <Button type="submit" variant="hero" className="h-12 w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Search />} Send OTP</Button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={verify} className="space-y-4">
              <p className="text-sm">We sent a 6-digit code to <span className="font-semibold">{sentTo}</span>.</p>
              {demo && <p className="rounded-lg bg-accent p-3 text-sm text-primary">Demo parcel — SMS isn't connected yet. Your code is <span className="font-mono font-bold">{demo}</span>.</p>}
              {!demo && <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">SMS delivery is not connected yet, so codes for real parcels can't be delivered until an SMS provider is set up.</p>}
              <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" aria-label="OTP" placeholder="••••••" className="h-14 text-center font-mono text-2xl tracking-[0.6em]" required minLength={6} autoFocus />
              <Button type="submit" variant="hero" className="h-12 w-full" disabled={busy || otp.length !== 6}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify & track</Button>
              <div className="flex justify-between text-sm">
                <button type="button" className="flex items-center gap-1 text-muted-foreground" onClick={() => setStep("code")}><ArrowLeft className="h-4 w-4" /> Change details</button>
                <button type="button" className="font-semibold text-primary" disabled={busy} onClick={() => requestOtp()}>Resend code</button>
              </div>
            </form>
          )}

        </div>
          )}
        </div>
      </section>

      <main className="public-container py-10 pb-20">
        {step === "done" && t && (
        <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-6 shadow-card sm:p-8">
            <Reveal stagger={0.05}>
              <div data-reveal className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                <div className="min-w-0">
                  <button type="button" onClick={() => { navigator.clipboard.writeText(t.tracking_code); toast.success("Tracking number copied"); }} className="flex max-w-full items-center gap-2 font-mono text-lg font-bold" aria-label="Copy tracking number"><span className="truncate">{t.tracking_code}</span><Copy className="h-4 w-4 shrink-0 text-muted-foreground" /></button>
                  <p className="text-sm text-muted-foreground">For {t.receiver} · {t.city}</p>
                </div>
                <StatusBadge status={t.status} />
              </div>
              <div data-reveal className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-brand transition-all duration-1000" style={{ width: `${progress}%` }} /></div>
              <div data-reveal className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {t.receiver_address && <p className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-primary" />{t.receiver_address}</p>}
                <p className="flex gap-2"><Package className="h-4 w-4 shrink-0 text-primary" />{t.delivered_at ? `Delivered ${fmtDate(t.delivered_at)}` : t.promised_by ? `Expected by ${fmtDate(t.promised_by)}` : "In progress"}{Number(t.cod_amount) > 0 && ` · Pay ${inr(Number(t.cod_amount))} on delivery`}</p>
              </div>
              <div data-reveal className="mt-5"><ClientOnly fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}><Suspense fallback={<div className="h-72 animate-pulse rounded-xl bg-muted" />}><TrackMap stops={stops} /></Suspense></ClientOnly></div>
              {Number(t.cod_amount) > 0 && t.status !== "delivered" && <Button asChild className="mt-4 w-full"><Link to="/pay" search={{ code: t.tracking_code }}>Pay {inr(Number(t.cod_amount))} online now</Link></Button>}
              <ol className="mt-6 space-y-0 border-l-2 border-border pl-6">
                {STATUS_FLOW.map((s) => {
                  const ev = reached.get(s);
                  return (
                    <li data-reveal key={s} className="relative pb-5">
                      <span className="absolute -left-[33px] top-0 bg-card">{ev ? <CheckCircle2 className="h-5 w-5 text-success" /> : <Circle className="h-5 w-5 text-border" />}</span>
                      <p className={`text-sm ${ev ? "font-semibold" : "text-muted-foreground"}`}>{STATUS_META[s].label}</p>
                      {ev && <p className="text-xs text-muted-foreground">{fmtDate(ev.at)}{ev.hub ? ` · ${ev.hub}` : ""}</p>}
                    </li>
                  );
                })}
              </ol>
              <Button variant="outline" className="mt-2" onClick={() => { setStep("code"); setT(null); setOtp(""); }}>Track another parcel</Button>
            </Reveal>
        </div>
        )}
        <div className="mx-auto mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
          {[
            { i: ShieldCheck, h: "Private by design", d: "Your parcel details show only after the code is confirmed." },
            { i: Clock, h: "Updated every scan", d: "Each hub and rider scan adds a new step to the journey." },
            { i: Headphones, h: "Need help?", d: "Share your tracking number with the seller or our support team." },
          ].map(({ i: I, h, d }) => (
            <div key={h} className="rounded-2xl border bg-card p-4"><I className="h-5 w-5 text-primary" /><p className="mt-2 text-sm font-semibold">{h}</p><p className="mt-1 text-xs text-muted-foreground">{d}</p></div>
          ))}
        </div>
      </main>
    </PublicShell>
  );
}
