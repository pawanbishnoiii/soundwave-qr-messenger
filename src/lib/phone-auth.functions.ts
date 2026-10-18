import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { canLogin, type LoginMode } from "./auth-rules";

export const phoneEmail = (phone: string) => `p${phone}@phone.bnoy.app`;

const phoneRe = /^[6-9][0-9]{9}$/;

import { sendOtpVia, type SmsSettings } from "./sms";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function findProfile(sb: Awaited<ReturnType<typeof admin>>, phone: string) {
  const { data } = await sb.from("profiles").select("id").or(`phone.eq.+91${phone},phone.eq.${phone}`).limit(1).maybeSingle();
  return data;
}

/** Sends via the admin-configured SMS gateway. Returns false when no gateway is set up. */
async function sendSms(sb: Awaited<ReturnType<typeof admin>>, phone: string, code: string): Promise<boolean> {
  const { data } = await sb.from("app_settings").select("value").eq("key", "sms").maybeSingle();
  const s = (data?.value ?? {}) as SmsSettings;
  if (!s.enabled) return false;
  try {
    const r = await sendOtpVia(s, phone, code);
    if (!r.ok) console.error("SMS failed", r.status, r.body);
    return r.ok;
  } catch (e) { console.error("SMS error", e); }
  return false;
}

/** Step 1: create a 6-digit code. Until an SMS gateway is configured the code is returned for on-screen display. */
export const requestPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ phone: z.string().regex(phoneRe) }).parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { count } = await sb.from("phone_otps").select("id", { count: "exact", head: true })
      .eq("phone", data.phone).gt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
    if ((count ?? 0) >= 5) return { error: "Too many codes requested. Try again in 10 minutes.", devCode: null, isNew: false, sent: false };
    const random = new Uint32Array(1); crypto.getRandomValues(random);
    const code = String(100000 + (random[0] ?? 0) % 900000);
    await sb.from("phone_otps").insert({ phone: data.phone, code });
    const sent = await sendSms(sb, data.phone, code);
    const prof = await findProfile(sb, data.phone);
    return { error: null, devCode: sent ? null : code, isNew: !prof, sent };
  });

const verifySchema = z.object({
  phone: z.string().regex(phoneRe),
  otp: z.string().regex(/^[0-9]{6}$/),
  name: z.string().trim().min(2).max(120).optional(),
  age: z.number().int().min(14).max(100).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  contactEmail: z.string().trim().email().max(200).optional().or(z.literal("")),
  address: z.string().trim().max(300).optional(),
  state: z.string().trim().max(80).optional(),
  district: z.string().trim().max(80).optional(),
  pincode: z.string().trim().regex(/^[0-9]{6}$/).optional().or(z.literal("")),
  password: z.string().min(6).max(72).optional(),
  purpose: z.enum(["login", "signup", "recovery"]).default("login"),
});

/** Step 2: verify code; new numbers must include name, age and gender. Returns a token hash for verifyOtp. */
export const verifyPhoneOtp = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => verifySchema.parse(d))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row } = await sb.from("phone_otps").select("*").eq("phone", data.phone).eq("used", false)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!row || new Date(row.expires_at) < new Date()) return { error: "Code expired — request a new one", needsProfile: false, tokenHash: null };
    if (row.attempts >= 5) return { error: "Too many wrong attempts — request a new code", needsProfile: false, tokenHash: null };
    if (row.code !== data.otp) {
      await sb.from("phone_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
      return { error: "Incorrect code", needsProfile: false, tokenHash: null };
    }

    const full = "+91" + data.phone;
    const prof = await findProfile(sb, data.phone);
    const { data: policyRow } = await sb.from("app_settings").select("value").eq("key", "auth_policy").maybeSingle();
    const currentPolicy = (policyRow?.value ?? {}) as { mode?: LoginMode };
    if (prof && !canLogin(currentPolicy.mode ?? "both", "otp", data.purpose)) return { error: "One-time code login is disabled by your admin. Use your password.", needsProfile: false, tokenHash: null };
    let email = phoneEmail(data.phone);
    if (prof) {
      const { data: u } = await sb.auth.admin.getUserById(prof.id);
      if (u?.user?.email) email = u.user.email;
    } else {
      if (!data.name || !data.age || !data.gender) return { error: null, needsProfile: true, tokenHash: null };
      const { data: pol } = await sb.from("app_settings").select("value").eq("key", "auth_policy").maybeSingle();
      const policy = (pol?.value ?? {}) as { mode?: string; email_required?: boolean };
      if (policy.email_required && !data.contactEmail) return { error: "Email is required", needsProfile: true, tokenHash: null };
      if (policy.mode !== "otp" && !data.password) return { error: "Choose a password", needsProfile: true, tokenHash: null };
      // OTP-only accounts get a random strong password they never need to know.
      const password = data.password || `${crypto.randomUUID()}Aa1!`;
      const { data: c, error } = await sb.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: data.name, phone: full, age: data.age, gender: data.gender },
      });
      if (error && !/already/i.test(error.message)) return { error: error.message, needsProfile: false, tokenHash: null };
      if (c?.user) await sb.from("profiles").update({
        full_name: data.name, phone: full, age: data.age, gender: data.gender, email: data.contactEmail || null,
        address: data.address || null, state: data.state || null, district: data.district || null, pincode: data.pincode || null,
      }).eq("id", c.user.id);
    }
    await sb.from("phone_otps").update({ used: true }).eq("id", row.id);
    const { data: link, error } = await sb.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link?.properties?.hashed_token) return { error: error?.message ?? "Could not sign in", needsProfile: false, tokenHash: null };
    // Recover accounts whose profile row was missing
    if (link.user && !prof) {
      await sb.from("profiles").upsert({
        id: link.user.id, full_name: data.name ?? "", phone: full, age: data.age ?? null, gender: data.gender ?? null,
        email: data.contactEmail || null, address: data.address || null, state: data.state || null,
        district: data.district || null, pincode: data.pincode || null,
      });
    }
    return { error: null, needsProfile: false, tokenHash: link.properties.hashed_token };
  });

export const loginWithPhonePassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ phone: z.string().regex(phoneRe), password: z.string().min(6).max(72) }).parse(input))
  .handler(async ({ data }) => {
    const sb = await admin();
    const { data: row } = await sb.from("app_settings").select("value").eq("key", "auth_policy").maybeSingle();
    const policy = (row?.value ?? {}) as { mode?: LoginMode };
    if (!canLogin(policy.mode ?? "both", "password")) throw new Error("Password login is disabled. Use a one-time code.");
    const profile = await findProfile(sb, data.phone);
    if (!profile) throw new Error("Wrong number or password");
    const { data: account } = await sb.auth.admin.getUserById(profile.id);
    if (!account.user?.email) throw new Error("Wrong number or password");
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env['SUPABASE_URL']; const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
    if (!url || !key) throw new Error("Login connection unavailable");
    const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: result, error } = await client.auth.signInWithPassword({ email: account.user.email, password: data.password });
    if (error || !result.session) throw new Error("Wrong number or password");
    return { access_token: result.session.access_token, refresh_token: result.session.refresh_token };
  });
