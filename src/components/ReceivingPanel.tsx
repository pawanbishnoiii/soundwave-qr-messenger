import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, ScanLine, Printer, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrScanner } from "@/components/QrScanner";
import { Brand } from "@/components/Brand";
import { useMe, useTeam } from "@/lib/auth";
import { captureScanLocation } from "@/lib/location";
import { parseScanned } from "@/lib/shipments";
import { reconcileManifest } from "@/lib/label-rules";

export function ReceivingPanel() {
  const { user } = useMe(); const team = useTeam(); const qc = useQueryClient();
  const [expected, setExpected] = useState(""); const [receiver, setReceiver] = useState("");
  const [bag, setBag] = useState(""); const [seal, setSeal] = useState(""); const [selected, setSelected] = useState("");
  const [scan, setScan] = useState(""); const [otp, setOtp] = useState(""); const [handoverCode, setHandoverCode] = useState("");
  const [note, setNote] = useState(""); const [sealCondition, setSealCondition] = useState("intact");
  const [damaged, setDamaged] = useState(false); const [camera, setCamera] = useState(false); const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const query = useQuery({ queryKey: ["receiving"], queryFn: async () => {
    const [m, p] = await Promise.all([supabase.from("receiving_manifests").select("*").order("created_at", { ascending: false }).limit(100), supabase.from("receiving_pieces").select("*").order("created_at").limit(5000)]);
    if (m.error || p.error) throw m.error ?? p.error;
    return { manifests: m.data ?? [], pieces: p.data ?? [] };
  } });
  const manifest = query.data?.manifests.find((m) => m.id === selected);
  const pieces = query.data?.pieces.filter((p) => p.manifest_id === selected) ?? [];
  const counts = reconcileManifest(manifest?.expected_codes ?? [], pieces.map((p) => p.code));
  const refresh = () => qc.invalidateQueries({ queryKey: ["receiving"] });
  async function create() {
    setBusy(true);
    try {
      await captureScanLocation();
      const codes = expected.split(/[\s,;]+/).filter(Boolean).map(parseScanned);
      const { data, error } = await supabase.rpc("create_receiving_manifest", { _codes: codes, _receiver: receiver || user?.id || "", _bag: bag, _seal: seal });
      if (error) throw error;
      const result = data as { id: string; handover_code: string };
      setSelected(result.id); setHandoverCode(result.handover_code); setExpected(""); await refresh(); toast.success("Incoming manifest created");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not create manifest"); }
    finally { setBusy(false); }
  }
  async function receive(raw: string) {
    if (!manifest || lock.current || !raw.trim()) return;
    lock.current = true; setBusy(true);
    try {
      await captureScanLocation();
      const { data, error } = await supabase.rpc("scan_receiving_piece", { _manifest: manifest.id, _code: parseScanned(raw), _damaged: damaged });
      if (error) throw error;
      const result = data as { duplicate: boolean; expected?: boolean };
      if (!result.duplicate) toast.success(result.expected ? "Parcel received" : "Unexpected parcel recorded");
      setScan(""); await refresh(); qc.invalidateQueries({ queryKey: ["shipments"] });
    } catch (error) { toast.error(error instanceof Error ? error.message : "Receipt scan failed"); }
    finally { lock.current = false; setBusy(false); }
  }
  async function confirm() {
    if (!manifest) return; setBusy(true);
    try {
      await captureScanLocation();
      const { data, error } = await supabase.rpc("confirm_receiving_manifest", { _manifest: manifest.id, _otp: otp, _note: note, _seal_condition: sealCondition });
      if (error) throw error;
      const result = data as { ok: boolean; message?: string };
      if (!result.ok) throw new Error(result.message);
      setOtp(""); setHandoverCode(""); await refresh(); toast.success("Custody receipt confirmed");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Confirmation failed"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-5 border-y py-6">
    <h2 className="flex items-center gap-2 text-xl font-semibold"><ClipboardCheck className="size-5 text-primary" />Franchise bulk receiving</h2>
    <div className="grid gap-3 sm:grid-cols-2"><textarea aria-label="Expected parcel references" placeholder="Expected tracking references, one per line or comma separated" value={expected} onChange={(e) => setExpected(e.target.value)} className="min-h-28 rounded-md border bg-background p-3 font-mono text-sm" />
      <div className="space-y-2"><select aria-label="Receiving staff" className="h-10 w-full rounded-md border bg-background px-3" value={receiver} onChange={(e) => setReceiver(e.target.value)}><option value="">Me · receiving staff</option>{team.data?.filter((p) => p.role && ["admin", "warehouse", "manager", "distributor"].includes(p.role)).map((p) => <option key={p.id} value={p.id}>{p.full_name} · {p.role}</option>)}</select><div className="flex gap-2"><Input placeholder="Bag reference" value={bag} onChange={(e) => setBag(e.target.value)} /><Input placeholder="Seal reference" value={seal} onChange={(e) => setSeal(e.target.value)} /></div><Button onClick={create} disabled={busy || !expected.trim()}><Plus />Create incoming manifest</Button></div></div>
    {handoverCode && <p role="status" className="rounded-md border border-primary bg-accent p-3 text-sm">Custody confirmation code: <strong className="font-mono">{handoverCode}</strong> · share with assigned receiving staff, not the customer.</p>}
    <select aria-label="Incoming manifest" value={selected} onChange={(e) => { setSelected(e.target.value); setHandoverCode(""); }} className="h-11 w-full rounded-md border bg-background px-3"><option value="">Select incoming manifest</option>{query.data?.manifests.map((m) => <option key={m.id} value={m.id}>{m.code} · {m.expected_codes.length} expected · {m.status}</option>)}</select>
    {manifest && <div className="space-y-4"><div className="grid grid-cols-3 gap-3">{[["Matched", counts.matched.length], ["Missing", counts.missing.length], ["Unexpected", counts.unexpected.length]].map(([label, count]) => <div key={label} className="border-b py-2"><p className="text-2xl font-semibold">{count}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
      {manifest.status === "open" ? <><div className="flex flex-wrap gap-2"><Input className="max-w-xs" aria-label="Receive parcel reference" value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void receive(scan); }} placeholder="Scan tracking reference" /><Button disabled={busy} onClick={() => receive(scan)}><ScanLine />Receive</Button><Button variant="outline" onClick={() => setCamera(!camera)}>Camera</Button><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={damaged} onChange={(e) => setDamaged(e.target.checked)} />Damaged</label></div>
      {camera && <div className="max-w-xs"><QrScanner onScan={receive} paused={busy} /></div>}
      <div className="flex flex-wrap gap-2"><select aria-label="Seal condition" className="h-10 rounded-md border bg-background px-3" value={sealCondition} onChange={(e) => setSealCondition(e.target.value)}><option value="intact">Seal intact</option><option value="broken">Seal broken</option><option value="missing">Seal missing</option></select><Input className="max-w-xs" placeholder="Custody handover code" aria-label="Custody handover code" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} /><Input placeholder="Discrepancy note" value={note} onChange={(e) => setNote(e.target.value)} /><Button onClick={confirm} disabled={busy || otp.length !== 6}>Confirm receiving receipt</Button></div></> : <Button variant="outline" onClick={() => window.print()}><Printer />Print receipt</Button>}
      <div className="max-h-52 overflow-auto text-sm"><p className="text-destructive">Missing: {counts.missing.join(", ") || "None"}</p><p className="text-muted-foreground">Unexpected: {counts.unexpected.join(", ") || "None"}</p>{pieces.map((p) => <p key={p.id} className="flex justify-between border-b py-2 font-mono text-xs"><span>{p.code}{p.damaged ? " · damaged" : ""}</span><span>{p.lat.toFixed(5)}, {p.lng.toFixed(5)}</span></p>)}</div>
      {manifest.status !== "open" && <div className="border-t pt-4"><Brand /><p className="mt-3 font-semibold">Receipt {manifest.code} · {manifest.status}</p><p className="text-xs text-muted-foreground">{manifest.confirmed_at} · Seal: {manifest.seal_condition} · GPS {manifest.confirmation_lat}, {manifest.confirmation_lng}</p><p className="text-sm">{manifest.discrepancy_note}</p></div>}
    </div>}
  </section>;
}