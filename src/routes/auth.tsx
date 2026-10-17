import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, KeyRound, Loader2, MessageSquareText, ShieldCheck, Smartphone, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { requestPhoneOtp, verifyPhoneOtp } from "@/lib/phone-auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/Brand";
import hero from "@/assets/hero-courier-woman.jpg";
import { Reveal } from "@/components/motion";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in with mobile — Bnoy Logistics OS" },
      { name: "description", content: "Sign in or create your Bnoy account with your mobile number and a one-time code." },
      { property: "og:title", content: "Sign in with mobile — Bnoy Logistics OS" },
      { property: "og:description", content: "Sign in or create your Bnoy account with your mobile number and a one-time code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Step = "phone" | "otp" | "profile";

function AuthPage() {
  const navigate = useNavigate();
  const request = useServerFn(requestPhoneOtp);
  const verify = useServerFn(verifyPhoneOtp);
  const [step, setStep] = useState<Step>("phone");
  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "">("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) navigate({ to: "/dashboard", replace: true }); });
  }, [navigate]);

  async function sendCode() {
    if (!/^[6-9][0-9]{9}$/.test(phone)) throw new Error("Enter a valid 10-digit mobile number");
    const r = await request({ data: { phone } });
    if (r.error) throw new Error(r.error);
    setDevCode(r.devCode); setIsNew(r.isNew); setOtp(""); setStep("otp");
    toast.success(r.sent ? `Code sent to +91 ${phone}` : "Code generated — shown on screen until SMS is connected");
  }

  async function finish(withProfile: boolean) {
    const r = await verify({ data: { phone, otp, ...(withProfile ? { name, age: Number(age), gender: gender as "male", contactEmail: email.trim() } : {}) } });
    if (r.error) throw new Error(r.error);
    if (r.needsProfile) { setStep("profile"); return; }
    const { error } = await supabase.auth.verifyOtp({ token_hash: r.tokenHash!, type: "magiclink" });
    if (error) throw error;
    toast.success(withProfile ? "Account created — welcome!" : "Signed in");
    navigate({ to: "/dashboard", replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (step === "phone") await sendCode();
      else if (step === "otp") {
        if (!/^[0-9]{6}$/.test(otp)) throw new Error("Enter the 6-digit code");
        if (isNew) { setStep("profile"); return; }
        await finish(false);
      } else {
        if (name.trim().length < 2) throw new Error("Enter your full name");
        const a = Number(age);
        if (!Number.isInteger(a) || a < 14 || a > 100) throw new Error("Enter a valid age (14–100)");
        if (!gender) throw new Error("Select your gender");
        if (email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) throw new Error("Enter a valid email or leave it empty");
        await finish(true);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally { setBusy(false); }
  }

  const steps: { key: Step; label: string; icon: typeof Smartphone }[] = [
    { key: "phone", label: "Mobile", icon: Smartphone },
    { key: "otp", label: "Code", icon: KeyRound },
    ...(isNew ? [{ key: "profile" as Step, label: "Profile", icon: UserRound }] : []),
  ];
  const idx = steps.findIndex((s) => s.key === step);

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Brand />
          <ol className="mt-10 flex items-center gap-2">
            {steps.map((s, i) => (
              <li key={s.key} className="flex flex-1 items-center gap-2">
                <span className={`grid size-9 shrink-0 place-items-center rounded-xl border transition-colors ${i <= idx ? "border-primary bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}><s.icon className="size-4" /></span>
                <span className={`text-xs font-medium ${i <= idx ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                {i < steps.length - 1 && <span className={`h-px flex-1 ${i < idx ? "bg-primary" : "bg-border"}`} />}
              </li>
            ))}
          </ol>

          <h1 className="mt-8 text-3xl font-bold">{step === "profile" ? "Tell us about you" : step === "otp" ? "Enter your code" : "Sign in with mobile"}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {step === "phone" ? "One page for everyone — riders, managers, distributors and admins." : step === "otp" ? `We sent a 6-digit code to +91 ${phone}.` : "New number — just once. The very first account becomes the Admin."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {step === "phone" && (
              <div className="space-y-1.5">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="flex gap-2">
                  <span className="grid h-12 place-items-center rounded-md border bg-muted px-3 text-sm font-medium text-muted-foreground">+91</span>
                  <Input id="phone" type="tel" inputMode="numeric" autoComplete="tel-national" required maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ""))} placeholder="98XXXXXXXX" className="h-12 text-base tracking-wider" autoFocus />
                </div>
              </div>
            )}
            {step === "otp" && (
              <>
                {devCode && (
                  <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-accent p-3 text-sm">
                    <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div><p className="font-medium">Your code: <span className="font-mono text-lg tracking-[0.3em]" data-testid="dev-otp">{devCode}</span></p>
                      <p className="text-xs text-muted-foreground">Shown here because no SMS gateway is connected yet.</p></div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="otp">One-time code</Label>
                  <Input id="otp" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} autoFocus value={otp} onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ""))} placeholder="••••••" className="h-12 text-center font-mono text-xl tracking-[0.6em]" />
                  <p className="flex justify-between text-xs text-muted-foreground">
                    <button type="button" className="inline-flex items-center gap-1 font-medium text-primary" onClick={() => setStep("phone")}><ArrowLeft className="size-3" />Change number</button>
                    <button type="button" className="font-medium text-primary" disabled={busy} onClick={async () => { setBusy(true); try { await sendCode(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>Resend code</button>
                  </p>
                </div>
              </>
            )}
            {step === "profile" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" required minLength={2} maxLength={120} autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
                </div>
                <div className="grid grid-cols-[100px_1fr] gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="age">Age</Label>
                    <Input id="age" inputMode="numeric" required maxLength={3} value={age} onChange={(e) => setAge(e.target.value.replace(/[^0-9]/g, ""))} className="h-11" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Gender">
                      {(["male", "female", "other"] as const).map((g) => (
                        <button key={g} type="button" role="radio" aria-checked={gender === g} onClick={() => setGender(g)}
                          className={`h-11 rounded-md border text-sm capitalize transition-colors ${gender === g ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{g}</button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email <span className="font-normal text-muted-foreground">(optional · for order updates)</span></Label>
                  <Input id="email" type="email" autoComplete="email" maxLength={200} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="h-11" />
                </div>
              </>
            )}
            <Button type="submit" variant="hero" className="h-12 w-full" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />} {step === "phone" ? "Send code" : step === "otp" ? (isNew ? "Continue" : "Verify & sign in") : "Create account"}
            </Button>
          </form>
          <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />No passwords. Your number is your login.</p>
        </div>
      </div>
      <div className="relative hidden overflow-hidden bg-gradient-hero lg:block">
        <img src={hero} alt="Bnoy courier with a parcel" width={1920} height={1024} className="absolute inset-0 h-full w-full object-cover object-[70%_center]" />
        <Reveal className="absolute inset-x-0 bottom-0 space-y-4 bg-gradient-to-t from-navy via-navy/80 to-transparent p-10 text-navy-foreground" stagger={0.12}>
          <p data-reveal className="font-display text-3xl font-bold">Scan. Assign. Deliver.</p>
          <ol className="grid gap-2 text-sm">
            {["Enter your mobile number", "Type the 6-digit code", "Land on your own role dashboard"].map((t, i) => (
              <li data-reveal key={t} className="flex items-center gap-3"><span className="grid h-6 w-6 place-items-center rounded-full bg-lime text-xs font-bold text-navy">{i + 1}</span>{t}</li>
            ))}
          </ol>
        </Reveal>
      </div>
    </div>
  );
}
