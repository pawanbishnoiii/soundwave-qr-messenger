import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function SeedDialog({ lotId, onClose, open }: { lotId: string | null; onClose: () => void; open?: boolean }) {
  const qc = useQueryClient();
  const [count, setCount] = useState(25);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    let left = Math.max(1, Math.floor(count));
    let made = 0;
    try {
      while (left > 0) {
        const n = Math.min(left, 1000);
        const { data, error } = await supabase.rpc("seed_demo_orders", lotId ? { _count: n, _lot: lotId } : { _count: n });
        if (error) throw error;
        made += data ?? n; left -= n;
      }
      toast.success(`${made} demo orders created with QR & barcodes`);
      qc.invalidateQueries({ queryKey: ["shipments"] });
      onClose();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Failed"); } finally { setBusy(false); }
  }
  return (
    <Dialog open={open ?? !!lotId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Generate demo orders</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">Creates realistic sample orders marked “DEMO”. Run it as many times as you like.</p>
        <div className="space-y-1.5"><Label htmlFor="cnt">How many</Label><Input id="cnt" type="number" min={1} max={10000} value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
        <div className="flex flex-wrap gap-2">{[10, 50, 100, 500].map((n) => <Button key={n} size="sm" variant="outline" onClick={() => setCount(n)}>{n}</Button>)}</div>
        <Button variant="hero" onClick={run} disabled={busy || count < 1}>{busy && <Loader2 className="animate-spin" />} Generate {count}</Button>
      </DialogContent>
    </Dialog>
  );
}
