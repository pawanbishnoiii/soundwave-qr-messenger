import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/auth";
import { useAuthPolicy } from "@/lib/public-settings";
import { STATE_NAMES, districtsOf } from "@/lib/india";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Onboarding card for signed-in users whose profile is missing required details. */
export function ProfileCompletion() {
  const { user, profile } = useMe();
  const policy = useAuthPolicy().data;
  const qc = useQueryClient();
  const p = (profile ?? {}) as Record<string, string | number | null>;
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  if (!user || !profile) return null;
  const v = (k: string) => f[k] ?? String(p[k] ?? "");
  const missing = !p["full_name"] || !p["state"] || !p["district"] || !p["age"] || !p["gender"] || (policy?.email_required && !p["email"]);
  if (!missing) return null;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (v("full_name").trim().length < 2) return toast.error("Enter your full name");
    if (!v("state") || !v("district")) return toast.error("Select state and district");
    if (policy?.email_required && !v("email").includes("@")) return toast.error("Email is required");
    setBusy(true);
    const age = Number(v("age")) || null;
    const { error } = await supabase.from("profiles").update({
      full_name: v("full_name").trim(), age, gender: (v("gender") || null) as never, email: v("email").trim() || null,
      state: v("state"), district: v("district"), address: v("address").trim() || null, pincode: v("pincode") || null,
    }).eq("id", user!.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    qc.invalidateQueries({ queryKey: ["me"] });
  }
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value, ...(k === "state" ? { district: "" } : {}) });

  return (
    <form onSubmit={save} className="mb-6 rounded-2xl border border-primary/30 bg-card p-5 shadow-card">
      <h2 className="flex items-center gap-2 font-semibold"><UserRound className="size-5 text-primary" />Complete your profile</h2>
      <p className="mt-1 text-sm text-muted-foreground">A few details are missing. Fill them once to keep using every feature.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1"><Label htmlFor="pc-name">Full name</Label><Input id="pc-name" value={v("full_name")} onChange={set("full_name")} /></div>
        <div className="space-y-1"><Label htmlFor="pc-age">Age</Label><Input id="pc-age" inputMode="numeric" value={v("age")} onChange={set("age")} /></div>
        <div className="space-y-1"><Label htmlFor="pc-g">Gender</Label><select id="pc-g" value={v("gender")} onChange={set("gender")} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></div>
        <div className="space-y-1"><Label htmlFor="pc-e">Email {policy?.email_required ? "*" : "(optional)"}</Label><Input id="pc-e" type="email" value={v("email")} onChange={set("email")} /></div>
        <div className="space-y-1"><Label htmlFor="pc-s">State</Label><select id="pc-s" value={v("state")} onChange={set("state")} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select state</option>{STATE_NAMES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="pc-d">District</Label><select id="pc-d" value={v("district")} onChange={set("district")} disabled={!v("state")} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Select district</option>{districtsOf(v("state")).map((d) => <option key={d}>{d}</option>)}</select></div>
        <div className="space-y-1"><Label htmlFor="pc-a">Address</Label><Input id="pc-a" value={v("address")} onChange={set("address")} /></div>
        <div className="space-y-1"><Label htmlFor="pc-p">Pincode</Label><Input id="pc-p" inputMode="numeric" maxLength={6} value={v("pincode")} onChange={set("pincode")} /></div>
      </div>
      <Button type="submit" className="mt-4" disabled={busy}>Save details</Button>
    </form>
  );
}
