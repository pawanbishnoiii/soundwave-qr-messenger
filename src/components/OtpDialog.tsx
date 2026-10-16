import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MessageSquareText, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { playError, playSuccess } from "@/lib/sound";
import type { Shipment } from "@/lib/status";

/** Sends the (demo) OTP to the receiver and confirms delivery once it is entered. */
export function OtpDialog({ shipment, onClose, onDone }: { shipment: Shipment | null; onClose: () => void; onDone?: (s: Shipment) => void }) {
  const [sent, setSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { setSent(!!shipment?.otp_sent_at); setOtp(""); }, [shipment?.id]);

  async function send() {
    if (!shipment) return;
    setBusy(true);
    const { data: res, error } = await supabase.rpc("send_delivery_otp", { _id: shipment.id });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
    const r = res as { sms_configured?: boolean; demo_code?: string | null } | null;
    if (r?.sms_configured) toast.success(`OTP sent to ${shipment.receiver_phone}`);
    else if (r?.demo_code) toast.warning(`SMS not connected — demo parcel code: ${r.demo_code}`, { duration: 10000 });
    else toast.warning("SMS provider not connected. Ask the customer for the OTP printed on their booking confirmation.");
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    if (!shipment) return;
    setBusy(true);
    const pos = await new Promise<GeolocationPosition | null>((res) => {
      if (!navigator.geolocation) return res(null);
      navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 4000, maximumAge: 60000 });
    });
    const { data, error } = await supabase.rpc("deliver_with_otp", { _id: shipment.id, _otp: otp, _lat: pos?.coords.latitude, _lng: pos?.coords.longitude });
    setBusy(false);
    if (error) { playError(); toast.error(error.message); return; }
    if (!data) { playError(); toast.error("Incorrect OTP"); return; }
    playSuccess();
    toast.success("Delivered — OTP verified");
    onDone?.(data as Shipment);
    onClose();
  }

  return (
    <Dialog open={!!shipment} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>Confirm delivery</DialogTitle></DialogHeader>
        {shipment && (
          <div className="space-y-4">
            <div className="rounded-xl bg-muted p-3 text-sm">
              <p className="font-mono font-bold">{shipment.tracking_code}</p>
              <p>{shipment.receiver_name} · {shipment.receiver_phone}</p>
              {Number(shipment.cod_amount) > 0 && <p className="mt-1 font-bold text-coral">Collect ₹{Number(shipment.cod_amount).toLocaleString("en-IN")} cash</p>}
            </div>
            {!sent ? (
              <Button variant="hero" className="w-full" onClick={send} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <MessageSquareText />} Send OTP to customer</Button>
            ) : (
              <form onSubmit={verify} className="space-y-3">
                <p className="text-sm text-muted-foreground">Ask the customer for the 4-digit code sent to their phone. <b>Demo OTP is 1234.</b></p>
                <Input autoFocus inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="••••" className="h-14 text-center font-mono text-2xl tracking-[0.5em]" />
                <Button variant="hero" className="w-full" disabled={busy || otp.length < 4}>{busy ? <Loader2 className="animate-spin" /> : <ShieldCheck />} Verify & mark delivered</Button>
                <button type="button" onClick={send} className="w-full text-center text-xs font-semibold text-primary">Resend OTP</button>
              </form>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
