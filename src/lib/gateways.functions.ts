import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Admin-only: send a test SMS through the saved gateway settings. */
export const testSmsGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string().regex(/^[6-9][0-9]{9}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { data: row } = await context.supabase.from("app_settings").select("value").eq("key", "sms").maybeSingle();
    const s = (row?.value ?? {}) as { enabled?: boolean; provider?: string; api_key?: string; url_template?: string };
    if (!s.enabled) return { ok: false, message: "Turn the SMS gateway on and save first" };
    const code = "123456";
    let r: Response;
    if (s.provider === "fast2sms" && s.api_key) {
      r = await fetch("https://www.fast2sms.com/dev/bulkV2", { method: "POST", headers: { authorization: s.api_key, "Content-Type": "application/json" }, body: JSON.stringify({ route: "otp", variables_values: code, numbers: data.phone }) });
    } else if (s.provider === "custom" && s.url_template) {
      r = await fetch(s.url_template.replace("{phone}", encodeURIComponent(data.phone)).replace("{otp}", code));
    } else return { ok: false, message: "Gateway details are incomplete" };
    const body = (await r.text()).slice(0, 300);
    return { ok: r.ok, message: r.ok ? "Test message accepted by the gateway" : `Gateway replied ${r.status}: ${body}` };
  });

/** Admin-only: check Razorpay keys by listing one payment. */
export const testRazorpay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("Admins only");
    const { data: row } = await context.supabase.from("app_settings").select("value").eq("key", "razorpay").maybeSingle();
    const s = (row?.value ?? {}) as { key_id?: string; key_secret?: string };
    if (!s.key_id || !s.key_secret) return { ok: false, message: "Add Key ID and Key Secret first" };
    const r = await fetch("https://api.razorpay.com/v1/payments?count=1", { headers: { Authorization: "Basic " + btoa(`${s.key_id}:${s.key_secret}`) } });
    return { ok: r.ok, message: r.ok ? "Razorpay keys are valid" : `Razorpay replied ${r.status}: ${(await r.text()).slice(0, 200)}` };
  });
