import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { phoneOtpLogin } from "@/lib/phone-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/Brand";
import hero from "@/assets/bnoy-operations.webp";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in with mobile — Bnoy Logistics OS" },
      { name: "description", content: "Sign in or create your Bnoy account with your mobile number and OTP." },
      { property: "og:title", content: "Sign in with mobile — Bnoy Logistics OS" },
      { property: "og:description", content: "Sign in or create your Bnoy account with your mobile number and OTP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const login = useServerFn(phoneOtpLogin);
  const [step, setStep] = useState<"phone" | "otp" | "name">("phone");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (step === "phone") {
        if (!/^[6-9][0-9]{9}$/.test(phone)) throw new Error("Enter a valid 10-digit mobile number");
        setStep("otp");
        toast.success(`OTP sent to +91 ${phone} (demo OTP: 1234)`);
        return;
      }
      if (!/^[0-9]{4}$/.test(otp)) throw new Error("Enter the 4-digit OTP");
      const r = await login({ data: { phone, otp, name: step === "name" ? name : undefined } });
      if (r.error) throw new Error(r.error);
      if (r.needsName) { setStep("name"); toast("New number — tell us your name to create your account"); return; }
      const { error } = await supabase.auth.verifyOtp({ token_hash: r.tokenHash!, type: "magiclink" });
      if (error) throw error;
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Brand />
          <span className="mt-10 inline-flex size-12 items-center justify-center rounded-2xl bg-accent text-primary"><Smartphone className="size-6" /></span>
          <h1 className="mt-5 text-3xl font-bold">{step === "name" ? "Create your account" : "Sign in with mobile"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "phone" ? "New or returning — we'll send a one-time code to your number." : step === "otp" ? `Enter the code sent to +91 ${phone}.` : "One last step. The very first account becomes the Admin."}
          </p>

          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="phone">Mobile number</Label>
              <div className="flex gap-2">
                <span className="grid h-11 place-items-center rounded-md border bg-muted px-3 text-sm font-medium text-muted-foreground">+91</span>
                <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required maxLength={10} disabled={step !== "phone"} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))} placeholder="98XXXXXXXX" className="h-11 text-base tracking-wider" autoFocus />
              </div>
            </div>
            {step !== "phone" && (
              <div className="space-y-1.5">
                <Label htmlFor="otp">One-time code</Label>
                <Input id="otp" inputMode="numeric" autoComplete="one-time-code" required maxLength={4} disabled={step === "name"} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))} placeholder="••••" className="h-12 text-center font-mono text-xl tracking-[0.8em]" />
                <p className="flex justify-between text-xs text-muted-foreground">
                  <span>Demo mode: use 1234</span>
                  <button type="button" className="font-medium text-primary" onClick={() => { setStep("phone"); setOtp(""); }}>Change number</button>
                </p>
              </div>
            )}
            {step === "name" && (
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" required minLength={2} maxLength={120} autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
              </div>
            )}
            <Button type="submit" variant="hero" className="h-11 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {step === "phone" ? "Send OTP" : step === "otp" ? "Verify & continue" : "Create account"}
            </Button>
          </form>
          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />No passwords. Your number is your login.</p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-hero lg:block">
        <img src={hero} alt="Delivery rider with QR-labelled parcel" width={1280} height={1024} className="absolute inset-0 h-full w-full object-cover opacity-90" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-navy to-transparent p-10 text-navy-foreground">
          <p className="font-display text-2xl font-bold">Scan. Assign. Deliver.</p>
          <p className="mt-1 text-sm opacity-80">Admin → Distributor → Manager → Rider, all in one flow.</p>
        </div>
      </div>
    </div>
  );
}
