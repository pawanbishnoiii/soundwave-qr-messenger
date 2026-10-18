import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { CreditCard, Loader2, Mail, MessageSquareText, PlugZap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { testRazorpay, testSmsGateway, testStripe } from "@/lib/gateways.functions";

export const Route = createFileRoute("/_authenticated/gateways")({
  head: () => pageHead("Gateways — SMS, email & payments", "Connect an SMS gateway, SMTP mailbox and Razorpay for your logistics workspace."),
  component: Gateways,
});

type Settings = { [k: string]: string | boolean | undefined; enabled?: boolean; provider?: string; api_key?: string; url_template?: string; host?: string; port?: string; user?: string; password?: string; from_name?: string; template_id?: string; publishable_key?: string; secret_key?: string; merchant_id?: string; merchant_key?: string; production?: boolean; key_id?: string; key_secret?: string };

function useSetting(key: string) {
  const q = useQuery({ queryKey: ["app_settings", key], queryFn: async () => ((await supabase.from("app_settings").select("value").eq("key", key).maybeSingle()).data?.value ?? {}) as Settings });
  const [v, setV] = useState<Settings>({});
  useEffect(() => { if (q.data) setV(q.data); }, [q.data]);
  return { v, setV, loaded: !!q.data };
}

function Card({ icon, title, status, children }: { icon: ReactNode; title: string; status: boolean; children: ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-5 shadow-card">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold">{icon}{title}</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>{status ? "Connected" : "Not set up"}</span>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </section>
  );
}

function Field({ label, value, onChange, type = "text", placeholder }: { label: string; value: unknown; onChange: (v: string) => void; type?: string; placeholder?: string }) {
  const id = label.replace(/\W/g, "");
  return <div className="space-y-1"><Label htmlFor={id}>{label}</Label><Input id={id} type={type} placeholder={placeholder} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} /></div>;
}

function Gateways() {
  const { role } = useMe();
  const qc = useQueryClient();
  const sms = useSetting("sms"), smtp = useSetting("smtp"), rzp = useSetting("razorpay"), stripe = useSetting("stripe"), paytm = useSetting("paytm");
  const [busy, setBusy] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const tSms = useServerFn(testSmsGateway), tRzp = useServerFn(testRazorpay), tStripe = useServerFn(testStripe);

  if (role && role !== "admin") return <AppShell title="Gateways"><p className="text-sm text-muted-foreground">Only admins can manage gateways.</p></AppShell>;

  async function save(key: string, value: Settings) {
    setBusy(key);
    const { error } = await supabase.from("app_settings").upsert({ key, value: value as never, updated_at: new Date().toISOString() });
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Saved"); qc.invalidateQueries({ queryKey: ["app_settings", key] });
  }
  async function test(fn: () => Promise<{ ok: boolean; message: string }>, k: string) {
    setBusy(k); try { const r = await fn(); r.ok ? toast.success(r.message) : toast.error(r.message); } catch (e) { toast.error((e as Error).message); } finally { setBusy(null); }
  }

  return (
    <AppShell title="Gateways">
      <p className="mb-6 max-w-2xl text-sm text-muted-foreground">Until an SMS gateway is turned on, login and tracking codes are shown on screen. Settings are visible to admins only.</p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card icon={<MessageSquareText className="size-4 text-primary" />} title="SMS gateway (OTP)" status={!!sms.v.enabled}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([["fast2sms", "Fast2SMS"], ["2factor", "2Factor"], ["msg91", "MSG91"], ["custom", "Custom URL"]] as const).map(([p, l]) => (
              <button key={p} type="button" onClick={() => sms.setV({ ...sms.v, provider: p })} className={`h-10 rounded-md border text-sm ${sms.v.provider === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{l}</button>
            ))}
          </div>
          {(sms.v.provider === "msg91" || sms.v.provider === "2factor") && <Field label={sms.v.provider === "msg91" ? "OTP template ID" : "Template name (optional)"} value={sms.v.template_id} onChange={(x) => sms.setV({ ...sms.v, template_id: x })} />}
          {sms.v.provider === "custom"
            ? <Field label="Request URL" value={sms.v.url_template} onChange={(x) => sms.setV({ ...sms.v, url_template: x })} placeholder="https://api.example.com/send?to={phone}&otp={otp}&key=..." />
            : <Field label="API key" type="password" value={sms.v.api_key} onChange={(x) => sms.setV({ ...sms.v, api_key: x })} />}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!sms.v.enabled} onChange={(e) => sms.setV({ ...sms.v, enabled: e.target.checked })} /> Send real SMS codes</label>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save("sms", sms.v)} disabled={busy === "sms"}>{busy === "sms" && <Loader2 className="animate-spin" />}Save</Button>
            <Input className="w-40" placeholder="Test number" value={testPhone} onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, ""))} maxLength={10} />
            <Button variant="outline" disabled={busy === "tsms"} onClick={() => test(() => tSms({ data: { phone: testPhone } }), "tsms")}><PlugZap />Send test</Button>
          </div>
        </Card>

        <Card icon={<Mail className="size-4 text-primary" />} title="Email (SMTP)" status={smtp.v.enabled !== false}>
          <p className="text-xs text-muted-foreground">Default: Gmail · bnoy.studios@gmail.com · port 465 SSL/TLS. The app password is stored securely; leave Password empty to use it.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([["gmail", "Gmail", "smtp.gmail.com", "465", "ssl"], ["hostinger", "Hostinger", "smtp.hostinger.com", "465", "ssl"], ["outlook", "Outlook", "smtp.office365.com", "587", "starttls"], ["custom", "Custom", "", "587", "starttls"]] as const).map(([p, l, h, port, sec]) => (
              <button key={p} type="button" onClick={() => smtp.setV({ ...smtp.v, provider: p, host: h || smtp.v.host || "", port, security: sec })} className={`h-10 rounded-md border text-sm ${(smtp.v.provider ?? "gmail") === p ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"}`}>{l}</button>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_90px_130px] gap-2">
            <Field label="Mail server" value={smtp.v.host} onChange={(x) => smtp.setV({ ...smtp.v, host: x })} placeholder="smtp.gmail.com" />
            <Field label="Port" value={smtp.v.port} onChange={(x) => smtp.setV({ ...smtp.v, port: x })} placeholder="465" />
            <div className="space-y-1"><Label htmlFor="smtpsec">Security</Label>
              <select id="smtpsec" className="h-9 w-full rounded-md border bg-background px-2 text-sm" value={(smtp.v["security"] as string) ?? "ssl"} onChange={(e) => smtp.setV({ ...smtp.v, security: e.target.value, port: e.target.value === "ssl" ? "465" : "587" })}>
                <option value="ssl">SSL/TLS (465)</option><option value="starttls">STARTTLS (587)</option>
              </select></div>
          </div>
          <Field label="Sender email (username)" value={smtp.v.user} onChange={(x) => smtp.setV({ ...smtp.v, user: x })} placeholder="bnoy.studios@gmail.com" />
          <Field label="Password (optional override)" type="password" value={smtp.v.password} onChange={(x) => smtp.setV({ ...smtp.v, password: x })} placeholder="Using saved app password" />
          <Field label="From name" value={smtp.v.from_name} onChange={(x) => smtp.setV({ ...smtp.v, from_name: x })} placeholder="Bnoy Logistics" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={smtp.v.enabled !== false} onChange={(e) => smtp.setV({ ...smtp.v, enabled: e.target.checked })} /> Send emails</label>
          <div className="flex flex-wrap gap-3 text-sm">
            {["welcome", "order_booked", "out_for_delivery", "delivered"].map((k) => (
              <label key={k} className="flex items-center gap-1.5 capitalize"><input type="checkbox" checked={smtp.v[`n_${k}`] !== false} onChange={(e) => smtp.setV({ ...smtp.v, [`n_${k}`]: e.target.checked })} />{k.replace(/_/g, " ")}</label>
            ))}
          </div>
          <Button onClick={() => save("smtp", smtp.v)} disabled={busy === "smtp"}>{busy === "smtp" && <Loader2 className="animate-spin" />}Save</Button>
        </Card>

        <Card icon={<CreditCard className="size-4 text-primary" />} title="Razorpay payments" status={!!rzp.v.key_id && !!rzp.v.key_secret}>
          <Field label="Key ID" value={rzp.v.key_id} onChange={(x) => rzp.setV({ ...rzp.v, key_id: x })} placeholder="rzp_live_..." />
          <Field label="Key Secret" type="password" value={rzp.v.key_secret} onChange={(x) => rzp.setV({ ...rzp.v, key_secret: x })} />
          <div className="flex gap-2">
            <Button onClick={() => save("razorpay", rzp.v)} disabled={busy === "razorpay"}>{busy === "razorpay" && <Loader2 className="animate-spin" />}Save</Button>
            <Button variant="outline" disabled={busy === "trzp"} onClick={() => test(() => tRzp(), "trzp")}><PlugZap />Check keys</Button>
          </div>
        </Card>

        <Card icon={<CreditCard className="size-4 text-primary" />} title="Stripe payments" status={!!stripe.v.publishable_key && !!stripe.v.secret_key}>
          <Field label="Publishable key" value={stripe.v.publishable_key} onChange={(x) => stripe.setV({ ...stripe.v, publishable_key: x })} placeholder="pk_live_..." />
          <Field label="Secret key" type="password" value={stripe.v.secret_key} onChange={(x) => stripe.setV({ ...stripe.v, secret_key: x })} placeholder="sk_live_..." />
          <div className="flex gap-2">
            <Button onClick={() => save("stripe", stripe.v)} disabled={busy === "stripe"}>{busy === "stripe" && <Loader2 className="animate-spin" />}Save</Button>
            <Button variant="outline" disabled={busy === "tstripe"} onClick={() => test(() => tStripe(), "tstripe")}><PlugZap />Check keys</Button>
          </div>
        </Card>

        <Card icon={<CreditCard className="size-4 text-primary" />} title="Paytm payments" status={!!paytm.v.merchant_id && !!paytm.v.merchant_key}>
          <Field label="Merchant ID (MID)" value={paytm.v.merchant_id} onChange={(x) => paytm.setV({ ...paytm.v, merchant_id: x })} />
          <Field label="Merchant key" type="password" value={paytm.v.merchant_key} onChange={(x) => paytm.setV({ ...paytm.v, merchant_key: x })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!paytm.v.production} onChange={(e) => paytm.setV({ ...paytm.v, production: e.target.checked })} /> Live mode (off = staging)</label>
          <Button onClick={() => save("paytm", paytm.v)} disabled={busy === "paytm"}>{busy === "paytm" && <Loader2 className="animate-spin" />}Save</Button>
        </Card>
      </div>
    </AppShell>
  );
}
