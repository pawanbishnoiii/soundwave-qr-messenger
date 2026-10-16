import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Phone, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { playError, playSuccess } from "@/lib/sound";
import type { Shipment } from "@/lib/status";

/** Rider calls the customer and cancels only with the customer's OTP (demo: 1234). No wallet credit on cancel. */
export function CancelOtpDialog({ shipment, onClose, onDone }: { shipment: Shipment | null; onClose: () => void; onDone?: () => void }) {
  const [otp, setOtp] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!shipment) return;
    setBusy(true);
    const { error } = await supabase.rpc("cancel_with_otp", { _id: shipment.id, _otp: otp, _reason: reason.trim().slice(0, 300) });
    setBusy(false);
    if (error) { playError(); toast.error(error.message); return; }
    playSuccess();
    toast.success("Order cancelled with customer OTP");
    setOtp(""); setReason("");
    onDone?.();
    onClose();
  }

  return (
    <Dialog open={!!shipment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader><DialogTitle>Cancel order</DialogTitle></DialogHeader>
        {shipment && (
          <form onSubmit={submit} className="space-y-4">
            <div className="rounded-lg bg-muted p-3 text-sm">
              <p className="font-semibold">{shipment.receiver_name}</p>
              <a href={`tel:${shipment.receiver_phone}`} className="mt-2 inline-flex items-center gap-2 font-semibold text-primary"><Phone className="h-4 w-4" /> Call {shipment.receiver_phone}</a>
              <p className="mt-2 text-xs text-muted-foreground">Ask the customer for their order OTP. Demo OTP: 1234.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cr">Reason</Label>
              <Input id="cr" required minLength={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Customer refused, wrong item…" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="co">Customer OTP</Label>
              <Input id="co" required inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))} className="font-mono tracking-[0.5em]" />
            </div>
            <Button type="submit" variant="destructive" className="w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <XCircle />} Confirm cancel</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
