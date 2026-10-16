import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { pageHead } from "@/lib/seo";
import { AppShell } from "@/components/AppShell";
import { useMe, useTeam } from "@/lib/auth";
import { useShipments } from "@/lib/shipments";
import { riderStats, useRatings, useWalletTxns } from "@/lib/rider";
import { inr } from "@/lib/status";

export const Route = createFileRoute("/_authenticated/riders")({
  head: () => pageHead("Rider performance", "Rider wallets, ratings and daily delivery accuracy"),
  component: Riders,
});

function Riders() {
  const { role } = useMe();
  const { data: team = [] } = useTeam();
  const { data: rows = [] } = useShipments();
  const { data: txns = [] } = useWalletTxns();
  const { data: ratings = [] } = useRatings();
  const riders = team.filter((t) => t.role === "rider").map((r) => ({ r, s: riderStats(r.id, rows, txns, ratings) })).sort((a, b) => b.s.delivered - a.s.delivered);
  const totalWallet = riders.reduce((a, x) => a + x.s.wallet, 0);

  if (role === "rider") return <AppShell title="Rider performance"><p className="text-muted-foreground">Only team leads can view this page.</p></AppShell>;

  return (
    <AppShell title="Rider performance">
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-card p-4 shadow-card"><p className="text-xs text-muted-foreground">Riders</p><p className="text-2xl font-bold">{riders.length}</p></div>
        <div className="rounded-lg border bg-card p-4 shadow-card"><p className="text-xs text-muted-foreground">Wallet payable</p><p className="text-2xl font-bold">{inr(totalWallet)}</p></div>
        <div className="rounded-lg border bg-card p-4 shadow-card"><p className="text-xs text-muted-foreground">Pending parcels</p><p className="text-2xl font-bold">{riders.reduce((a, x) => a + x.s.pending, 0)}</p></div>
      </div>
      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left text-xs uppercase text-muted-foreground">
            <tr><th className="p-3">Rider</th><th className="p-3">Pending</th><th className="p-3">Delivered</th><th className="p-3">Today</th><th className="p-3">Accuracy today</th><th className="p-3">Rating</th><th className="p-3">Wallet</th><th className="p-3">COD due</th></tr>
          </thead>
          <tbody className="divide-y">
            {riders.map(({ r, s }) => (
              <tr key={r.id}>
                <td className="p-3 font-semibold">{r.full_name}<div className="text-xs font-normal text-muted-foreground">{r.phone}</div></td>
                <td className="p-3 tabular">{s.pending}</td>
                <td className="p-3 tabular">{s.delivered}</td>
                <td className="p-3 tabular">{s.deliveredToday}</td>
                <td className="p-3 tabular">{s.accuracyToday === null ? "—" : `${s.accuracyToday}%`}</td>
                <td className="p-3">{s.rating === null ? "—" : <span className="inline-flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-current text-warning" />{s.rating.toFixed(1)} ({s.ratingCount})</span>}</td>
                <td className="p-3 font-semibold tabular">{inr(s.wallet)}</td>
                <td className="p-3 tabular">{inr(s.codPending)}</td>
              </tr>
            ))}
            {riders.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No riders in your team yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
