import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const phoneEmail = (phone: string) => `p${phone}@phone.bnoy.app`;
export const DEMO_OTP = "1234";

const loginSchema = z.object({
  phone: z.string().regex(/^[6-9][0-9]{9}$/),
  otp: z.string().regex(/^[0-9]{4}$/),
  name: z.string().trim().max(120).optional(),
});

/**
 * Mobile + OTP sign-in / sign-up. DEMO: OTP is fixed (1234) until an SMS provider is connected.
 * Returns a one-time token hash the browser exchanges for a session via verifyOtp.
 */
export const phoneOtpLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.otp !== DEMO_OTP) return { error: "Incorrect OTP", needsName: false, tokenHash: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const full = "+91" + data.phone;

    // Existing account linked to this number (also covers staff added by admins).
    // Profiles store only the phone; the login identity is looked up on the auth account.
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("id")
      .or(`phone.eq.${full},phone.eq.${data.phone}`)
      .limit(1).maybeSingle();
    let email: string = phoneEmail(data.phone);
    if (prof) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(prof.id);
      if (u?.user?.email) email = u.user.email;
    }

    if (!prof) {
      if (!data.name || data.name.length < 2) return { error: null, needsName: true, tokenHash: null };
      const password = crypto.randomUUID() + "Aa1!";
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: data.name, phone: full, phone_verified_demo: true },
      });
      if (error) { console.error("phone signup failed:", error.message); return { error: error.message, needsName: false, tokenHash: null }; }
    }
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    if (error || !link?.properties?.hashed_token) return { error: error?.message ?? "Could not sign in", needsName: false, tokenHash: null };
    return { error: null, needsName: false, tokenHash: link.properties.hashed_token };
  });
