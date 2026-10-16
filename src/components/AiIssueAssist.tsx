import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { triageDeliveryIssue, type TriageResult } from "@/lib/ai-triage.functions";

const URGENCY: Record<string, string> = {
  high: "bg-destructive/15 text-destructive",
  medium: "bg-accent text-primary",
  low: "bg-muted text-muted-foreground",
};

export function AiIssueAssist({ shipmentId }: { shipmentId: string }) {
  const run = useServerFn(triageDeliveryIssue);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<TriageResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setRes(null);
    try { setRes(await run({ data: { shipmentId, description: text } })); }
    catch (err) { toast.error(err instanceof Error ? err.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <section className="rounded-lg border bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-bold"><Sparkles className="h-4 w-4 text-primary" />AI delivery issue assist</h2>
      <p className="mt-1 text-xs text-muted-foreground">Describe the problem. AI classifies it using this parcel's status and suggests the next step.</p>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} minLength={5} maxLength={2000} required placeholder="e.g. Customer not picking calls, shop was closed at the address" />
        <Button type="submit" disabled={busy || text.trim().length < 5}>{busy ? <Loader2 className="animate-spin" /> : <Sparkles />} Analyse issue</Button>
      </form>
      {res && (
        <div className="mt-5 space-y-3 border-t pt-4 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-navy px-2 py-1 text-xs font-semibold text-navy-foreground">{res.category}</span>
            <span className={`rounded-md px-2 py-1 text-xs font-semibold capitalize ${URGENCY[res.urgency] ?? ""}`}>{res.urgency} urgency</span>
            <span className="text-xs text-muted-foreground">{Math.round(res.confidence * 100)}% confident</span>
          </div>
          <p className="text-muted-foreground">{res.summary}</p>
          <div className="rounded-md bg-accent p-3"><p className="text-xs font-semibold uppercase text-primary">Next action</p><p className="mt-1 font-semibold">{res.next_action}</p></div>
          {res.steps.length > 0 && <ol className="list-decimal space-y-1 pl-5">{res.steps.map((s) => <li key={s}>{s}</li>)}</ol>}
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase text-muted-foreground">Message for customer</p>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(res.customer_message); toast.success("Copied"); }}><Copy /></Button></div>
            <p className="mt-1">{res.customer_message}</p>
          </div>
        </div>
      )}
    </section>
  );
}
