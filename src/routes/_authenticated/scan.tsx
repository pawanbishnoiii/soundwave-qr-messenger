import { MODE_IDS, type Mode } from "@/lib/scan-modes";
import { pageHead } from "@/lib/seo";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { z } from "zod";
import { CheckCircle2, XCircle, Volume2, VolumeX, Keyboard, PackagePlus, ShieldCheck, Ban, AlertTriangle, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { QrScanner } from "@/components/QrScanner";
import { StatusBadge } from "@/components/StatusBadge";
import { OtpDialog } from "@/components/OtpDialog";
import { CancelOtpDialog } from "@/components/CancelOtpDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useMe } from "@/lib/auth";
import { parseScanned } from "@/lib/shipments";
import { playError, playSuccess, unlockAudio } from "@/lib/sound";
import { selectCls } from "@/lib/ui";
import { STATUS_META, type Shipment } from "@/lib/status";
import { captureScanLocation } from "@/lib/location";


export const Route = createFileRoute("/_authenticated/scan")({
  validateSearch: z.object({ mode: z.enum(MODE_IDS).optional(), lot: z.string().optional() }),
  head: () => pageHead("Scan parcels", "Scan QR codes and barcodes with your camera"),
  component: ScanPage,
});

const LABEL: Record<Mode, string> = {
  lookup: "Lookup", lot: "Add to lot", claim: "Claim parcel", picked_up: "Pickup",
  hub_received: "Hub in", sorted: "Sort", in_transit: "Dispatch", out_for_delivery: "Out for delivery",
  failed: "Failed attempt", delivered: "Deliver (OTP)",
};

type Result = { ok: boolean; code: string; msg: string; shipment?: Shipment; at: number };

function ScanPage() {
  const qc = useQueryClient();
  const { role, user } = useMe();
  const isRider = role === "rider";
  const [active, setActive] = useState<Shipment | null>(null);
  const [cancelFor, setCancelFor] = useState<Shipment | null>(null);
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/scan" });
  const mode: Mode = search.mode ?? (role === "rider" ? "claim" : "lookup");
  const setMode = (m: Mode) => navigate({ search: (p) => ({ ...p, mode: m }) });
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const [log, setLog] = useState<Result[]>([]);
  const [otpFor, setOtpFor] = useState<Shipment | null>(null);
  const last = useRef<{ code: string; t: number }>({ code: "", t: 0 });

  const lots = useQuery({
    queryKey: ["lots"],
    queryFn: async () => (await supabase.from("lots").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const modes = MODE_IDS.filter((m) => (role === "rider" ? m !== "lot" : m !== "claim"));

  function push(r: Result) {
    if (sound) (r.ok ? playSuccess : playError)();
    setLog((l) => [r, ...l].slice(0, 30));
  }

  async function handle(raw: string) {
    const code = parseScanned(raw);
    const now = Date.now();
    if (!code || (code === last.current.code && now - last.current.t < 3000) || otpFor) return;
    last.current = { code, t: now };
    setBusy(true);
    try {
      const fix = await captureScanLocation();
      if (isRider) {
        const clean = code.replace(/[^A-Z0-9-]/gi, "").toUpperCase();
        let { data: s } = await supabase.from("shipments").select("*").eq("tracking_code", clean).maybeSingle();
        if (!s || s.rider_id !== user?.id) {
          const { data, error } = await supabase.rpc("claim_shipment", { _code: clean });
          if (error) throw error;
          s = data as never;
        }
        const sh = s as Shipment;
        setActive(sh);
        push({ ok: true, code, msg: sh.status === "out_for_delivery" ? "In your bucket — choose an action" : `Found · ${STATUS_META[sh.status].label}`, shipment: sh, at: now });
        qc.invalidateQueries({ queryKey: ["shipments"] });
        return;
      }
      if (mode === "claim") {
        const { data, error } = await supabase.rpc("claim_shipment", { _code: code });
        if (error) throw error;
        push({ ok: true, code, msg: "Added to your deliveries", shipment: data as Shipment, at: now });
        qc.invalidateQueries({ queryKey: ["shipments"] });
        return;
      }
      const { data: s, error } = await supabase.from("shipments").select("*").or(`tracking_code.eq.${code.replace(/[^A-Z0-9-]/g, "")},id.eq.${/^[0-9a-f-]{36}$/i.test(code) ? code.toLowerCase() : "00000000-0000-0000-0000-000000000000"}`).maybeSingle();
      if (error) throw error;
      if (!s) throw new Error("Not found or not in your team");
      let shipment = s as Shipment;
      let msg = `Found · ${STATUS_META[shipment.status].label}`;
      if (mode === "lot") {
        if (!search.lot) throw new Error("Choose a lot first");
        const { data: u, error: ue } = await supabase.from("shipments").update({ lot_id: search.lot }).eq("id", shipment.id).select("*").single();
        if (ue) throw ue;
        shipment = u as Shipment; msg = "Added to lot";
      } else if (mode === "delivered") {
        if (shipment.status === "delivered") msg = "Already delivered";
        else { setOtpFor(shipment); msg = "Waiting for customer OTP"; }
      } else if (mode !== "lookup") {
        if (shipment.status === mode) msg = `Already ${STATUS_META[mode].label}`;
        else {
          let failure: string | null = null;
          if (mode === "failed") {
            failure = window.prompt("Failure reason (e.g. Customer not reachable, Address incomplete)")?.trim() || null;
            if (!failure) throw new Error("Failure reason required");
          }
          const { data: u, error: ue } = await supabase.rpc("scan_transition", {
            _code: shipment.tracking_code, _to: mode, _source: "camera",
            _lat: fix.lat, _lng: fix.lng,
            ...(failure ? { _failure: failure } : {}),
          });
          if (ue) throw ue;
          const r = u as unknown as { duplicate: boolean; shipment: Shipment };
          shipment = r.shipment; msg = r.duplicate ? `Duplicate scan — already ${STATUS_META[mode].label}` : `Updated → ${STATUS_META[mode].label}`;
        }
      }
      qc.invalidateQueries({ queryKey: ["shipments"] });
      push({ ok: true, code, msg, shipment, at: now });
    } catch (e) {
      push({ ok: false, code, msg: e instanceof Error ? e.message : "Scan failed", at: now });
    } finally {
      setBusy(false);
    }
  }

  async function riderMove(to: "out_for_delivery" | "failed") {
    if (!active) return;
    let failure: string | null = null;
    if (to === "failed") {
      failure = window.prompt("Why couldn't you deliver? (e.g. Customer not reachable)")?.trim() || null;
      if (!failure) return;
    }
    setBusy(true);
    try {
      const fix = await captureScanLocation();
      const { data, error } = await supabase.rpc("scan_transition", { _code: active.tracking_code, _to: to, _source: "camera", _lat: fix.lat, _lng: fix.lng, ...(failure ? { _failure: failure } : {}) });
      if (error) throw error;
      const sh = (data as unknown as { shipment: Shipment }).shipment;
      setActive(sh);
      push({ ok: true, code: sh.tracking_code, msg: to === "failed" ? "Marked as failed attempt" : "Added to your bucket", shipment: sh, at: Date.now() });
      qc.invalidateQueries({ queryKey: ["shipments"] });
    } catch (e) {
      push({ ok: false, code: active.tracking_code, msg: e instanceof Error ? e.message : "Update failed", at: Date.now() });
    } finally { setBusy(false); }
  }

  const latest = log[0];
  const okCount = log.filter((l) => l.ok).length;

  return (
    <AppShell
      title="Scan parcels"
      actions={<Button variant="outline" size="icon" onClick={() => { unlockAudio(); setSound((v) => !v); }} aria-label="Toggle sound">{sound ? <Volume2 /> : <VolumeX />}</Button>}
    >
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-2">
        <div onClick={unlockAudio} className="min-w-0">
          {!isRider && <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
            {modes.map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${mode === m ? "border-transparent bg-gradient-brand text-primary-foreground shadow-glow" : "bg-card hover:border-primary"}`}>
                {LABEL[m]}
              </button>
            ))}
          </div>}
          {!isRider && (mode === "lot" || mode === "claim") && (
            <select className={`${selectCls} mb-4`} value={search.lot ?? ""} onChange={(e) => navigate({ search: (p) => ({ ...p, lot: e.target.value || undefined }) })}>
              <option value="">{mode === "claim" ? "Any lot from my manager" : "Select lot to add parcels into"}</option>
              {(lots.data ?? []).map((l) => <option key={l.id} value={l.id}>{l.code} {l.name && `· ${l.name}`}</option>)}
            </select>
          )}
          <QrScanner onScan={handle} paused={busy || !!otpFor || !!cancelFor} />
          <p className="mt-2 text-center text-xs text-muted-foreground">Reads QR codes and barcodes · hold the label inside the frame</p>
          <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); unlockAudio(); last.current = { code: "", t: 0 }; void handle(manual); setManual(""); }}>
            <div className="relative flex-1">
              <Keyboard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="Tracking code or order ID" className="pl-9 font-mono uppercase" maxLength={40} />
            </div>
            <Button type="submit" variant="hero" disabled={!manual.trim() || busy}>Go</Button>
          </form>
        </div>

        <div className="min-w-0 space-y-4">
          {isRider && active && (
            <div key={active.id + active.status} className="rounded-3xl border bg-card p-5 shadow-card animate-rise">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0"><p className="font-mono text-sm font-bold">{active.tracking_code}</p><p className="truncate text-lg font-semibold">{active.receiver_name}</p><p className="line-clamp-2 text-sm text-muted-foreground">{active.receiver_address}, {active.city}</p></div>
                <StatusBadge status={active.status} />
              </div>
              {Number(active.cod_amount) > 0 && <p className="mt-2 inline-block rounded-full bg-coral/15 px-3 py-1 text-sm font-bold text-coral">Collect COD ₹{Number(active.cod_amount).toLocaleString("en-IN")}</p>}
              <div className="mt-4 grid grid-cols-2 gap-2">
                {active.status === "out_for_delivery" ? (
                  <>
                    <Button className="col-span-2 h-12 bg-success text-primary-foreground hover:bg-success/90" onClick={() => setOtpFor(active)} disabled={busy}><ShieldCheck /> Delivered (customer OTP)</Button>
                    <Button variant="outline" className="h-11" onClick={() => riderMove("failed")} disabled={busy}><AlertTriangle /> Attempt failed</Button>
                    <Button variant="outline" className="h-11 border-destructive/40 text-destructive" onClick={() => setCancelFor(active)} disabled={busy}><Ban /> Cancel (OTP)</Button>
                    <Button asChild variant="ghost" className="col-span-2"><a href={`tel:${active.receiver_phone}`}><Phone /> Call customer</a></Button>
                  </>
                ) : ["delivered", "cancelled", "returned", "return_initiated"].includes(active.status) ? (
                  <p className="col-span-2 text-sm text-muted-foreground">This parcel is closed — no further action.</p>
                ) : (
                  <>
                    <Button variant="hero" className="col-span-2 h-12" onClick={() => riderMove("out_for_delivery")} disabled={busy}><PackagePlus /> Add to my delivery bucket</Button>
                    <p className="col-span-2 text-xs text-muted-foreground">Delivery and cancellation unlock once the parcel is in your bucket.</p>
                  </>
                )}
              </div>
            </div>
          )}
          <div className="flex items-center justify-between rounded-lg bg-gradient-hero p-4 text-navy-foreground">
            <div><p className="text-xs opacity-75">Mode</p><p className="font-display text-lg font-bold">{isRider ? "Scan → choose action" : LABEL[mode]}</p></div>
            <div className="text-right"><p className="text-xs opacity-75">Successful scans</p><p className="font-display text-2xl font-bold tabular">{okCount}</p></div>
          </div>
          {latest ? (
            <div key={latest.at} className={`rounded-lg border-2 p-5 shadow-card animate-rise ${latest.ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10"}`}>
              <div className="flex items-center gap-3">
                {latest.ok ? <CheckCircle2 className="h-8 w-8 shrink-0 text-success" /> : <XCircle className="h-8 w-8 shrink-0 text-destructive" />}
                <div className="min-w-0"><p className="truncate font-mono text-lg font-bold">{latest.code}</p><p className="text-sm">{latest.msg}</p></div>
              </div>
              {latest.shipment && (
                <Link to="/shipments/$id" params={{ id: latest.shipment.id }} className="mt-4 block rounded-md bg-card p-4">
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2"><p className="truncate font-semibold">{latest.shipment.receiver_name}</p><StatusBadge status={latest.shipment.status} /></div>
                  <p className="truncate text-sm text-muted-foreground">{latest.shipment.receiver_address}, {latest.shipment.city}</p>
                  {Number(latest.shipment.cod_amount) > 0 && <p className="mt-1 text-sm font-bold text-coral tabular">Collect COD ₹{Number(latest.shipment.cod_amount).toLocaleString("en-IN")}</p>}
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
              Point the camera at a parcel label. Each successful scan plays a chime; problems play a buzz.
            </div>
          )}
          {log.length > 1 && (
            <div className="rounded-lg border bg-card p-4 shadow-card">
              <p className="mb-2 text-sm font-bold">Scan history</p>
              <ul className="divide-y text-sm">
                {log.slice(1).map((r) => (
                  <li key={r.at} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 py-2">
                    {r.ok ? <CheckCircle2 className="h-4 w-4 text-success" /> : <XCircle className="h-4 w-4 text-destructive" />}
                    <span className="truncate"><span className="font-mono font-semibold">{r.code}</span> · {r.msg}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <OtpDialog shipment={otpFor} onClose={() => setOtpFor(null)} onDone={(s) => { if (isRider) setActive(s); push({ ok: true, code: s.tracking_code, msg: "Delivered with OTP", shipment: s, at: Date.now() }); qc.invalidateQueries({ queryKey: ["shipments"] }); }} />
      <CancelOtpDialog shipment={cancelFor} onClose={() => setCancelFor(null)} onDone={() => { setCancelFor(null); setActive(null); push({ ok: true, code: cancelFor?.tracking_code ?? "", msg: "Cancelled with customer OTP", at: Date.now() }); qc.invalidateQueries({ queryKey: ["shipments"] }); }} />
    </AppShell>
  );
}
