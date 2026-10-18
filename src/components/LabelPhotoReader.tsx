import { useRef, useState } from "react";
import { Camera, Loader2, ScanLine } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { extractLabelDetails } from "@/lib/label-rules";

export function LabelPhotoReader({ onSelect }: { onSelect: (code: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false); const [progress, setProgress] = useState(0);
  const [text, setText] = useState(""); const [code, setCode] = useState("");
  const [destination, setDestination] = useState("");
  async function read(file: File) {
    if (!file.type.startsWith("image/") || file.size > 10 * 1024 * 1024) { toast.error("Choose a label image under 10 MB"); return; }
    setBusy(true); setDestination(""); setCode(""); setText("");
    let worker: Awaited<ReturnType<typeof import("tesseract.js").createWorker>> | undefined;
    try {
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("eng", 1, { logger: (message) => { if (message.status === "recognizing text") setProgress(Math.round(message.progress * 100)); } });
      const result = await worker.recognize(file);
      const details = extractLabelDetails(result.data.text); setText(details.text); setCode(details.tracking ?? "");
      if (details.tracking) await lookup(details.tracking);
      if (!details.tracking) toast.message("Confirm the tracking reference from the label");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not read this label"); }
    finally { await worker?.terminate(); setBusy(false); }
  }
  async function lookup(value: string) {
    const { data, error } = await supabase.from("shipments").select("tracking_code,city,pincode,receiver_name").eq("tracking_code", value.trim().toUpperCase()).maybeSingle();
    if (error) { toast.error(error.message); return; }
    setDestination(data ? `${data.city} · ${data.pincode ?? "No pincode"} · ${data.receiver_name}` : "No matching parcel in your workspace — review required");
  }
  return <section className="space-y-3 border-t pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex items-center gap-2 font-semibold"><ScanLine className="size-5 text-primary" />Read parcel label</h2><Button variant="outline" onClick={() => input.current?.click()} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Camera />}{busy ? `Reading ${progress}%` : "Label photo"}</Button></div>
    <input ref={input} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void read(file); e.target.value = ""; }} />
    {text && <><details className="text-xs text-muted-foreground"><summary>Recognized label text</summary><pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap">{text}</pre></details><div className="flex gap-2"><Input aria-label="Extracted tracking reference" value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); setDestination(""); }} /><Button variant="outline" onClick={() => lookup(code)} disabled={!code}>Check destination</Button></div>
      {destination && <p className="text-sm text-primary">{destination}</p>}<Button onClick={() => onSelect(code)} disabled={!code || !destination || destination.startsWith("No matching")}>Use this parcel</Button></>}
  </section>;
}