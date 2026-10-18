import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, MapPin, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMe } from "@/lib/auth";
import { useAuthPolicy, useMapsSetting, type AuthPolicy, type MapsSetting } from "@/lib/public-settings";
import { supabase } from "@/integrations/supabase/client";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/login-maps")({ head: () => pageHead("Login rules & maps", "Manage Bnoy login methods, email requirements and Google Maps with OpenStreetMap fallback."), component: LoginMaps });
function LoginMaps() {
  const { role } = useMe(); const qc = useQueryClient();
  const policy = useAuthPolicy(); const mapQuery = useMapsSetting();
  const [auth, setAuth] = useState<AuthPolicy>({ mode: "both", email_required: false });
  const [maps, setMaps] = useState<MapsSetting>({ provider: "google" });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (policy.data) setAuth(policy.data); }, [policy.data]);
  useEffect(() => { if (mapQuery.data) setMaps(mapQuery.data); }, [mapQuery.data]);
  async function save() {
    setBusy(true);
    const { error } = await supabase.from("app_settings").upsert([
      { key: "auth_policy", value: { ...auth }, updated_at: new Date().toISOString() },
      { key: "maps", value: { ...maps }, updated_at: new Date().toISOString() },
    ]);
    setBusy(false); if (error) { toast.error(error.message); return; }
    await qc.invalidateQueries({ queryKey: ["app_settings"] }); toast.success("Login and map rules saved");
  }
  return <AppShell title="Login rules & maps">{role === "admin" ? <div className="max-w-3xl space-y-8">
    <section className="space-y-5 border-b pb-8"><h2 className="flex items-center gap-2 text-xl font-semibold"><KeyRound className="size-5 text-primary" />Login rules</h2>
      <div className="space-y-2"><Label htmlFor="login-method">Allowed login method</Label><select id="login-method" className="h-11 w-full rounded-md border bg-background px-3" value={auth.mode} onChange={(e) => setAuth({ ...auth, mode: e.target.value as AuthPolicy["mode"] })}><option value="both">One-time code or password</option><option value="otp">One-time code only</option><option value="password">Password only (OTP for signup and recovery)</option></select></div>
      <div className="flex items-center justify-between gap-4"><Label htmlFor="email-rule">Require email during onboarding</Label><Switch id="email-rule" checked={auth.email_required} onCheckedChange={(email_required) => setAuth({ ...auth, email_required })} /></div>
    </section>
    <section className="space-y-5 border-b pb-8"><h2 className="flex items-center gap-2 text-xl font-semibold"><MapPin className="size-5 text-primary" />Maps</h2>
      <div className="space-y-2"><Label htmlFor="map-provider">Preferred provider</Label><select id="map-provider" className="h-11 w-full rounded-md border bg-background px-3" value={maps.provider} onChange={(e) => setMaps({ ...maps, provider: e.target.value as MapsSetting["provider"] })}><option value="google">Google Maps first · OpenStreetMap fallback</option><option value="osm">OpenStreetMap</option></select></div>
      <div className="space-y-2"><Label htmlFor="browser-key">Custom Google Maps browser key (optional)</Label><Input id="browser-key" value={maps.google_key ?? ""} onChange={(e) => setMaps({ ...maps, google_key: e.target.value.trim() })} placeholder="Use connected Google Maps credentials" /></div>
      <p className="text-sm text-muted-foreground">Only a website-restricted browser key belongs here. Private server keys stay in secure connector settings. OpenStreetMap is used automatically if Google Maps cannot load.</p>
    </section>
    <Button onClick={save} disabled={busy || policy.isLoading || mapQuery.isLoading}>{busy ? <Loader2 className="animate-spin" /> : <Save />}Save rules</Button>
  </div> : <p className="text-muted-foreground">Only admins can change login and map rules.</p>}</AppShell>;
}