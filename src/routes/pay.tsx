import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CheckCircle2, CreditCard, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPaymentDue, payShipment } from "@/lib/pay.functions";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/pay")({
  head: () => pageHead("Pay for your parcel", "Pay the amount due on your Bnoy parcel with Razorpay, Stripe or Paytm."),
  validateSearch: (s: Record<string, unknown>) => ({ code: typeof s["code"] === "string" ? s["code"] : undefined }),
  component: PayPage,
});

type Due = Extract<Awaited<ReturnType<typeof getPaymentDue>>, { ok: true }>;
type Done = Extract<Awaited<ReturnType<typeof payShipment>>, { ok: true }>;
const GATEWAYS = [
  { id: "razorpay", name: "Razorpay", sub: "UPI, cards, netbanking", icon: Wallet },
  { id: "stripe", name: "Stripe", sub: "International cards", icon: CreditCard },
  { id: "paytm", name: "Paytm", sub: "Paytm wallet & UPI", icon: Wallet },
] as const;
const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function PayPage() {
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code ?? "");
  const [phone, setPhone] = useState("");
  const [due, setDue] = useState<Due | null>(null);
  const [gw, setGw] = useState<(typeof GATEWAYS)[number]["id"]>("razorpay");
  const [done, setDone] = useState<Done | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const look = useServerFn(getPaymentDue), pay = useServerFn(payShipment);

  async function find(e: React.FormEvent) {
    e.preventDefault(); setErr(""); setBusy(true);
    try { const r = await look({ data: { code, phone } }); r.ok ? setDue(r) : setErr(r.message); } catch { setErr("Check the tracking code and 10-digit phone"); } finally { setBusy(false); }
  }
  async function doPay() {
    setErr(""); setBusy(true);
    try { const r = await pay({ data: { code, phone, gateway: gw } }); r.ok ? setDone(r) : setErr(r.message); } finally { setBusy(false); }
  }

  return <PublicShell><div className="public-container max-w-xl py-14">
    <p className="eyebrow">Secure payment</p>
    <h1 className="section-heading mt-3">Pay for your parcel</h1>
    {done ? (
      <div className="mt-8 rounded-2xl border bg-card p-8 text-center shadow-card">
        <CheckCircle2 className="mx-auto size-14 text-primary" />
        <h2 className="mt-4 text-2xl font-semibold">Payment successful</h2>
        <p className="mt-2 text-muted-foreground">{inr(done.amount)} paid via {done.gateway} for {done.tracking}</p>
        <p className="mt-4 font-mono text-xs">Reference: {done.reference}</p>
        {done.testMode && <p className="mt-2 text-xs text-muted-foreground">Test mode — no real money was charged.</p>}
        <Button asChild className="mt-6"><Link to="/track" search={{ code: done.tracking }}>Track parcel</Link></Button>
      </div>
    ) : !due ? (
      <form onSubmit={find} className="mt-8 space-y-3 rounded-2xl border bg-card p-6 shadow-card">
        <Input aria-label="Tracking code" placeholder="Tracking code" value={code} onChange={(e) => setCode(e.target.value)} required />
        <Input aria-label="Phone number" placeholder="Receiver phone (10 digits)" inputMode="numeric" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} required />
        {err && <p className="text-sm text-destructive">{err}</p>}
        <Button type="submit" className="w-full h-11" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Find amount due</Button>
      </form>
    ) : (
      <div className="mt-8 space-y-4 rounded-2xl border bg-card p-6 shadow-card">
        <div className="flex items-end justify-between"><div><p className="text-sm text-muted-foreground">{due.tracking} · {due.name} · {due.city}</p><p className="font-display text-4xl font-bold">{inr(due.amount)}</p></div></div>
        {due.paid ? <p className="rounded-lg bg-primary/10 p-3 text-sm text-primary">Already paid via {due.paid.gateway} · {due.paid.gateway_payment_id}</p>
        : due.amount <= 0 ? <p className="text-sm text-muted-foreground">Nothing is due on this parcel.</p> : <>
          <div className="grid gap-2">{GATEWAYS.map((g) => (
            <button key={g.id} type="button" onClick={() => setGw(g.id)} className={`flex items-center gap-3 rounded-xl border p-4 text-left transition ${gw === g.id ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted"}`}>
              <g.icon className="size-5 text-primary" /><span><span className="block font-semibold">{g.name}</span><span className="text-xs text-muted-foreground">{g.sub}</span></span></button>))}</div>
          {err && <p className="text-sm text-destructive">{err}</p>}
          <Button className="h-12 w-full" onClick={doPay} disabled={busy}>{busy && <Loader2 className="animate-spin" />}Pay {inr(due.amount)}</Button>
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><ShieldCheck className="size-3.5" />Test mode is on until live gateway keys are added.</p>
        </>}
      </div>
    )}
  </div></PublicShell>;
}
