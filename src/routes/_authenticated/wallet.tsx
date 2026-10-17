import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDownLeft, Banknote, CalendarDays, TrendingUp, Wallet } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { CountUp, Reveal } from "@/components/motion";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { riderStats, useRatings, useWalletTxns } from "@/lib/rider";
import { fmtDate, inr } from "@/lib/status";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/wallet")({
  head: () => pageHead("My wallet", "Rider earnings, bonuses and cash in hand"),
  component: WalletPage,
});

function WalletPage() {
  const { user } = useMe();
  const { data: rows = [] } = useShipments();
  const { data: txns = [] } = useWalletTxns();
  const { data: ratings = [] } = useRatings();
  if (!user) return null;
  const st = riderStats(user.id, rows, txns, ratings);
  const mine = txns.filter((t) => t.rider_id === user.id);
  const weekAgo = Date.now() - 7 * 864e5;
  const week = mine.filter((t) => new Date(t.created_at).getTime() > weekAgo).reduce((a, t) => a + Number(t.amount), 0);
  const cashInHand = rows.filter((s) => s.rider_id === user.id && s.status === "delivered" && s.cod_collected && !s.cod_handover_id).reduce((a, s) => a + Number(s.cod_amount), 0);

  return (
    <AppShell title="My wallet">
      <div className="mx-auto max-w-xl space-y-4 pb-24">
        <Reveal className="relative overflow-hidden rounded-3xl bg-gradient-hero p-6 text-navy-foreground shadow-card" y={20}>
          <div aria-hidden className="absolute -right-10 -top-10 size-40 rounded-full bg-lime/20 blur-2xl" />
          <p data-reveal className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] opacity-75"><Wallet className="size-4" />Total earnings</p>
          <p data-reveal className="mt-2 font-display text-5xl font-bold tabular">₹<CountUp value={Math.round(st.wallet)} /></p>
          <div data-reveal className="mt-5 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-navy-foreground/10 p-3"><p className="text-[11px] opacity-70">Today</p><p className="font-display text-xl font-bold">{inr(st.earnedToday)}</p></div>
            <div className="rounded-2xl bg-navy-foreground/10 p-3"><p className="text-[11px] opacity-70">Last 7 days</p><p className="font-display text-xl font-bold">{inr(week)}</p></div>
          </div>
        </Reveal>

        <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-4 shadow-card">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-coral/15 text-coral"><Banknote className="size-5" /></span>
            <div><p className="text-xs text-muted-foreground">COD cash in hand</p><p className="font-display text-xl font-bold">{inr(cashInHand)}</p></div></div>
          <Button asChild size="sm" variant="hero"><Link to="/cash">Hand over</Link></Button>
        </div>

        <section className="rounded-2xl border bg-card p-4 shadow-card">
          <h2 className="flex items-center gap-2 font-bold"><TrendingUp className="size-4 text-primary" />Earnings history</h2>
          <ul className="mt-2 divide-y text-sm">
            {mine.slice(0, 50).map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 place-items-center rounded-full bg-success/15 text-success"><ArrowDownLeft className="size-4" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium capitalize">{t.note ?? t.kind.replace(/_/g, " ")}</span><span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3" />{fmtDate(t.created_at)}</span></span>
                <span className="font-semibold text-success tabular">+{inr(Number(t.amount))}</span>
              </li>
            ))}
            {mine.length === 0 && <li className="py-6 text-center text-muted-foreground">Deliver parcels to start earning — credits appear here automatically.</li>}
          </ul>
        </section>
      </div>
    </AppShell>
  );
}
