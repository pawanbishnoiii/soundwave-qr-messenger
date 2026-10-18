import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Loader2, Lock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Pill } from "@/components/CrudPage";
import { CountUp, Reveal } from "@/components/motion";
import { useMe } from "@/lib/auth";
import { fmtDate } from "@/lib/status";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/cash")({
  head: () => pageHead("Cash handovers", "Record, review and track COD cash handovers with an immutable ledger"),
  component: CashPage,
});

type H = { id: string; code: string; stage: string; from_user: string; to_user: string | null; expected_amount: number; received_amount: number | null; status: string; mismatch_note: string | null; shipment_count: number; created_at: string };
const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN")}`;

function CashPage() {
  const { role, user } = useMe();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [resolve, setResolve] = useState<H | null>(null);
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");

  const data = useQuery({
    queryKey: ["cash", user?.id], enabled: !!user,
    queryFn: async () => {
      const [h, l, pend, people] = await Promise.all([
        supabase.from("cod_handovers").select("*").order("created_at", { ascending: false }).limit(200),
        supabase.from("finance_ledger").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("shipments").select("cod_amount").eq("rider_id", user!.id).eq("status", "delivered").eq("cod_collected", true).is("cod_handover_id", null).gt("cod_amount", 0),
        supabase.from("profiles").select("id,full_name"),
      ]);
      const names = Object.fromEntries((people.data ?? []).map((p) => [p.id, p.full_name]));
      return { handovers: (h.data ?? []) as H[], ledger: l.data ?? [], pending: (pend.data ?? []).reduce((s, x) => s + Number(x.cod_amount), 0), pendingCount: pend.data?.length ?? 0, names };
    },
  });
  const d = data.data;
  const name = (id: string | null) => (id ? d?.names[id] ?? "—" : "Admin desk");
  const refresh = () => qc.invalidateQueries({ queryKey: ["cash"] });

  async function submit() {
    setBusy(true);
    const { data: h, error } = await supabase.rpc("submit_cod_handover");
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Handover ${(h as H).code} submitted`); refresh();
  }
  async function doResolve() {
    if (!resolve) return;
    setBusy(true);
    const { error } = await supabase.rpc("resolve_cod_handover", { _id: resolve.id, _received: Number(amt), _note: note });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Recorded"); setResolve(null); refresh();
  }
  const incoming = (d?.handovers ?? []).filter((h) => h.status === "submitted" && h.from_user !== user?.id && (h.to_user === user?.id || role === "admin"));
  const sumBy = (s: string) => (d?.handovers ?? []).filter((h) => h.status === s).reduce((a, h) => a + Number(h.expected_amount), 0);

  return (
    <AppShell title="Cash handovers">
      <div className="space-y-6">
        <Reveal className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" stagger={0.06}>
          {role === "rider" && <Stat label="Cash in hand" value={d?.pending ?? 0} sub={`${d?.pendingCount ?? 0} COD parcels`} />}
          <Stat label="Awaiting review" value={sumBy("submitted")} sub={`${incoming.length} for you`} />
          <Stat label="Accepted" value={sumBy("accepted")} sub="settled" />
          <Stat label="Mismatches" value={sumBy("mismatch")} sub="need follow-up" />
        </Reveal>

        {role !== "admin" && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-card p-5 shadow-card">
            <div><p className="font-semibold">{role === "rider" ? "Hand over collected COD to your manager" : "Forward accepted rider cash to admin"}</p>
              <p className="text-sm text-muted-foreground">The amount is calculated from delivered parcels — it can't be edited.</p></div>
            <Button onClick={submit} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Send />} Submit handover</Button>
          </div>
        )}

        {!!incoming.length && (
          <section className="space-y-2"><h2 className="font-display text-lg font-semibold">To review</h2>
            {incoming.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
                <div><p className="font-mono font-semibold">{h.code}</p><p className="text-sm text-muted-foreground">{name(h.from_user)} · {h.shipment_count} parcels · {fmtDate(h.created_at)}</p></div>
                <div className="flex flex-wrap items-center gap-3"><span className="text-lg font-bold">{inr(h.expected_amount)}</span>
                  <HandoverCode id={h.id} />
                  <Button size="sm" onClick={() => { setResolve(h); setAmt(String(h.expected_amount)); setNote(""); }}><CheckCircle2 /> Count & receive</Button></div>
              </div>))}
          </section>
        )}

        <section className="space-y-2"><h2 className="font-display text-lg font-semibold">Handover history</h2>
          <div className="overflow-x-auto rounded-xl border bg-card"><table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-4 py-2">Code</th><th className="px-4 py-2">From → To</th><th className="px-4 py-2">Expected</th><th className="px-4 py-2">Received</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Date</th></tr></thead>
            <tbody>{(d?.handovers ?? []).map((h) => (
              <tr key={h.id} className="border-t"><td className="px-4 py-2 font-mono">{h.code}</td><td className="px-4 py-2">{name(h.from_user)} → {name(h.to_user)}</td><td className="px-4 py-2">{inr(h.expected_amount)}</td><td className="px-4 py-2">{h.received_amount == null ? "—" : inr(h.received_amount)}</td>
                <td className="px-4 py-2"><Pill tone={h.status === "accepted" ? "ok" : h.status === "mismatch" ? "bad" : "warn"}>{h.status}</Pill>{h.mismatch_note && <span className="ml-2 text-xs text-muted-foreground">{h.mismatch_note}</span>}</td><td className="px-4 py-2 text-muted-foreground">{fmtDate(h.created_at)}</td></tr>))}
              {!d?.handovers.length && <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No handovers yet.</td></tr>}</tbody></table></div>
        </section>

        <section className="space-y-2"><h2 className="flex items-center gap-2 font-display text-lg font-semibold"><Lock className="h-4 w-4" /> Money ledger <span className="text-xs font-normal text-muted-foreground">append-only — entries can never be edited or deleted</span></h2>
          <div className="divide-y rounded-xl border bg-card">{(d?.ledger ?? []).map((l) => (
            <div key={l.id} className="flex items-center justify-between px-4 py-2 text-sm"><span><Banknote className="mr-2 inline h-4 w-4 text-primary" />{l.entry_type.replace(/_/g, " ")} <span className="text-muted-foreground">· {name(l.user_id)} · {l.note}</span></span><span className="font-semibold">{inr(l.amount)}</span></div>))}
            {!d?.ledger.length && <p className="p-6 text-center text-sm text-muted-foreground">No entries yet.</p>}</div>
        </section>
      </div>

      <Dialog open={!!resolve} onOpenChange={(o) => !o && setResolve(null)}>
        <DialogContent><DialogHeader><DialogTitle>Receive {resolve?.code}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Expected {resolve && inr(resolve.expected_amount)}. Enter the cash you actually counted. A different amount is recorded as a mismatch.</p>
          <Input type="number" aria-label="Received amount" value={amt} onChange={(e) => setAmt(e.target.value)} />
          {resolve && Number(amt) !== Number(resolve.expected_amount) && <Input aria-label="Mismatch note" placeholder="Reason for difference (required)" value={note} onChange={(e) => setNote(e.target.value)} />}
          <Button onClick={doResolve} disabled={busy || amt === ""}>{busy && <Loader2 className="animate-spin" />} Confirm</Button>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function HandoverCode({ id }: { id: string }) {
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function reveal() {
    setBusy(true);
    const { data, error } = await supabase.rpc("get_handover_otp", { _id: id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    if (!data) { toast.error("No active code for this handover"); return; }
    setCode(data as string);
  }
  if (code) return <span aria-label="Handover verification code" className="rounded-lg border-2 border-dashed border-primary bg-primary/10 px-3 py-1 font-mono text-lg font-bold tracking-[0.3em] text-primary">{code}</span>;
  return <Button size="sm" variant="outline" onClick={reveal} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Lock />} Show code for rider</Button>;
}

function Stat({ label, value, sub }: { label: string; value: number; sub: string }) {
  return <div data-reveal className="rounded-2xl border bg-card p-4 shadow-card"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl font-bold">₹<CountUp value={value} /></p><p className="text-xs text-muted-foreground">{sub}</p></div>;
}
