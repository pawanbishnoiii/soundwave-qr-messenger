import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { sendOtpVia, type SmsSettings } from "./sms";

type Ctx = { supabase: { rpc: (...a: never[]) => unknown }; userId: string };
async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as { rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }> };
  const { data } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}
export type { Ctx };

async function readSetting<T>(context: { supabase: unknown }, key: string): Promise<T> {
  const sb = context.supabase as { from: (t: string) => { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { value: unknown } | null }> } } } };
  const { data } = await sb.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value ?? {}) as T;
}

/** Admin-only: send a test SMS through the saved gateway settings. */
export const testSmsGateway = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ phone: z.string().regex(/^[6-9][0-9]{9}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const s = await readSetting<SmsSettings>(context, "sms");
    if (!s.enabled) return { ok: false, message: "Turn the SMS gateway on and save first" };
    const r = await sendOtpVia(s, data.phone, "123456");
    return { ok: r.ok, message: r.ok ? "Test message accepted by the gateway" : `Gateway replied ${r.status}: ${r.body}` };
  });

/** Admin-only: check Razorpay keys by listing one payment. */
export const testRazorpay = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const s = await readSetting<{ key_id?: string; key_secret?: string }>(context, "razorpay");
    if (!s.key_id || !s.key_secret) return { ok: false, message: "Add Key ID and Key Secret first" };
    const r = await fetch("https://api.razorpay.com/v1/payments?count=1", { headers: { Authorization: "Basic " + btoa(`${s.key_id}:${s.key_secret}`) } });
    return { ok: r.ok, message: r.ok ? "Razorpay keys are valid" : `Razorpay replied ${r.status}: ${(await r.text()).slice(0, 200)}` };
  });

/** Admin-only: check a Stripe secret key by reading the account balance. */
export const testStripe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const s = await readSetting<{ secret_key?: string }>(context, "stripe");
    if (!s.secret_key) return { ok: false, message: "Add the secret key first" };
    const r = await fetch("https://api.stripe.com/v1/balance", { headers: { Authorization: `Bearer ${s.secret_key}` } });
    return { ok: r.ok, message: r.ok ? "Stripe key is valid" : `Stripe replied ${r.status}: ${(await r.text()).slice(0, 200)}` };
  });
