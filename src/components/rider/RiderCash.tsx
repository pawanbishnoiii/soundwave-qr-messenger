import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { formatDistanceToNow } from "date-fns";
import { Banknote, CheckCircle2, ChevronRight, KeyRound, Mail, UserRound, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { sendHandoverOtpEmail } from "@/lib/email.functions";
import { inr } from "@/lib/status";
import handoverImg from "@/assets/rider-cash-handover.jpg";

type Receiver = { id: string; full_name: string; phone: string | null; role: string };
type Handover = { id: string; code: string; expected_amount: number; status: string; shipment_count: number; created_at: string; to_user: string | null };

export function useCashState(uid: string) {
  return useQuery({
    queryKey: ["rider-cash", uid],
    enabled: !!uid,
    queryFn: async () => {
      const [pend, hs] = await Promise.all([
        supabase.from("shipments").select("cod_amount").eq("rider_id", uid).eq("status", "delivered").eq("cod_collected", true).is("cod_handover_id", null).gt("cod_amount", 0),
        supabase.from("cod_handovers").select("id,code,expected_amount,status,shipment_count,created_at,to_user").eq("from_user", uid).order("created_at", { ascending: false }).limit(20),
      ]);
      const rows = pend.data ?? [];
      return { cash: rows.reduce((a, r) => a + Number(r.cod_amount), 0), count: rows.length, handovers: (hs.data ?? []) as Handover[] };
    },
  });
}

/** Wallet card that opens the in-app handover sheet. */
export function CashCard({ uid }: { uid: string }) {
  const { data } = useCashState(uid);
  const [open, setOpen] = useState(false);
  const waiting = data?.handovers.find((h) => h.status === "submitted");
  return (
    <>
      <button onClick={() => setOpen(true)} className="relative w-full overflow-hidden rounded-3xl border border-border bg-card text-left transition-transform active:scale-[0.98]">
        <img src={handoverImg} alt="" loading="lazy" width={1024} height={640} className="h-28 w-full object-cover opacity-80" />
        <div className="flex items-center justify-between p-4">
          <span className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary"><Banknote className="h-5 w-5" /></span>
            <span>
              <span className="block text-lg font-bold tabular">{inr(data?.cash ?? 0)} cash in hand</span>
              <span className="text-xs text-muted-foreground">{waiting ? `Waiting for code · ${waiting.code}` : `${data?.count ?? 0} COD parcels · hand over at your store`}</span>
            </span>
          </span>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </button>
      {open && <HandoverSheet uid={uid} onClose={() => setOpen(false)} />}
    </>
  );
}

function HandoverSheet({ uid, onClose }: { uid: string; onClose: () => void }) {
  const qc = useQueryClient();
  const mail = useServerFn(sendHandoverOtpEmail);
  const { data } = useCashState(uid);
  const { data: receivers = [] } = useQuery({
    queryKey: ["handover-receivers"],
    queryFn: async () => ((await supabase.rpc("list_handover_receivers")).data ?? []) as Receiver[],
  });
  const waiting = data?.handovers.find((h) => h.status === "submitted");
  const [to, setTo] = useState<string>("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["rider-cash", uid] });

  async function start() {
    if (!to) return toast.error("Pick who is receiving the cash");
    setBusy(true);
    const { data: r, error } = await supabase.rpc("rider_start_handover", { _to: to });
    if (error) { setBusy(false); return toast.error(error.message); }
    const id = (r as { id: string }).id;
    try { const m = await mail({ data: { id } }); toast.message(m.message); } catch { toast.message("Staff can see the code in their Cash page"); }
    setBusy(false); refresh();
  }
  async function resend(id: string) {
    try { const m = await mail({ data: { id } }); toast.message(m.message); } catch (e) { toast.error((e as Error).message); }
  }
  async function verify(id: string) {
    setBusy(true);
    const { data: ok, error } = await supabase.rpc("verify_handover_otp", { _id: id, _otp: otp });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!ok) return toast.error("Wrong code — ask staff again");
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.7 } });
    toast.success("Cash handed over"); setOtp(""); refresh();
  }
  const staffName = (id: string | null) => receivers.find((r) => r.id === id)?.full_name ?? "staff";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-h-[92dvh] max-w-md overflow-y-auto rounded-t-3xl border border-border bg-card p-5 pb-10 animate-sheet-up">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-muted" />
        <div className="flex items-start justify-between">
          <div><p className="text-sm text-muted-foreground">Cash handover</p><h2 className="text-3xl font-extrabold tabular">{inr(waiting ? Number(waiting.expected_amount) : data?.cash ?? 0)}</h2></div>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><X className="h-5 w-5" /></button>
        </div>

        {waiting ? (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-secondary p-4 text-sm">
              <p className="font-semibold">Give the cash to {staffName(waiting.to_user)}</p>
              <p className="mt-1 text-muted-foreground">They got a 6-digit code by email and on their screen. After counting, they tell you the code.</p>
            </div>
            <div className="relative">
              <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="••••••" className="h-16 w-full rounded-2xl border border-border bg-background pl-12 text-center font-mono text-3xl tracking-[0.5em] outline-none focus:border-primary" />
            </div>
            <button disabled={busy || otp.length !== 6} onClick={() => verify(waiting.id)} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"><CheckCircle2 className="h-5 w-5" /> Confirm handover</button>
            <button onClick={() => resend(waiting.id)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-medium"><Mail className="h-4 w-4" /> Email code again</button>
          </div>
        ) : (data?.count ?? 0) === 0 ? (
          <p className="mt-6 rounded-2xl bg-secondary p-6 text-center text-sm text-muted-foreground">No cash to hand over. Cash from COD deliveries shows up here.</p>
        ) : (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-muted-foreground">Who is receiving at the store?</p>
            {receivers.length ? receivers.map((r) => (
              <button key={r.id} onClick={() => setTo(r.id)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left ${to === r.id ? "border-primary bg-primary/10" : "border-border"}`}>
                <span className="grid h-10 w-10 place-items-center rounded-full bg-secondary"><UserRound className="h-5 w-5" /></span>
                <span className="flex-1"><span className="block font-semibold">{r.full_name || r.phone}</span><span className="text-xs capitalize text-muted-foreground">{r.role} {r.phone ? `· ${r.phone}` : ""}</span></span>
                {to === r.id && <CheckCircle2 className="h-5 w-5 text-primary" />}
              </button>
            )) : <p className="rounded-2xl bg-secondary p-4 text-sm text-muted-foreground">No franchise staff linked to you yet. Ask your manager to add you to their team.</p>}
            <button disabled={busy || !to} onClick={start} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground disabled:opacity-50"><Banknote className="h-5 w-5" /> Start handover · {data?.count} parcels</button>
          </div>
        )}

        {!!data?.handovers.length && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-semibold text-muted-foreground">History</p>
            <div className="divide-y divide-border rounded-2xl border border-border">
              {data.handovers.map((h) => (
                <div key={h.id} className="flex items-center justify-between p-3 text-sm">
                  <div><p className="font-mono">{h.code}</p><p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(h.created_at), { addSuffix: true })} · {staffName(h.to_user)}</p></div>
                  <div className="text-right"><p className="font-semibold tabular">{inr(Number(h.expected_amount))}</p><p className={`text-xs capitalize ${h.status === "accepted" ? "text-primary" : "text-muted-foreground"}`}>{h.status === "submitted" ? "waiting" : h.status}</p></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
