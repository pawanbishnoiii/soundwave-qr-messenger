import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SmtpSettings = { enabled?: boolean; host?: string; port?: string; user?: string; password?: string; from_name?: string };

async function getSmtp(sb: { from: (t: string) => unknown }) {
  const { data } = await (sb.from("app_settings") as { select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { value: unknown } | null }> } } })
    .select("value").eq("key", "smtp").maybeSingle();
  const s = (data?.value ?? {}) as SmtpSettings;
  const pass = s.password || process.env["SMTP_APP_PASSWORD"] || "";
  if (!s.enabled || !s.host || !s.user || !pass) return null;
  return { host: s.host, port: Number(s.port || 587), user: s.user, pass, fromName: s.from_name || "Bnoy Logistics" };
}

async function assertAdmin(context: { supabase: unknown; userId: string }) {
  const sb = context.supabase as { rpc: (f: string, a: Record<string, unknown>) => Promise<{ data: unknown }> };
  const { data } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Admins only");
}

/** Admin: send a test email through the saved SMTP settings. */
export const sendTestEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ to: z.string().email() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const cfg = await getSmtp(context.supabase);
    if (!cfg) return { ok: false, message: "SMTP is not enabled or incomplete — check host, sender email and password" };
    const { sendSmtpEmail, emailHtml } = await import("./smtp.server");
    const r = await sendSmtpEmail(cfg, data.to, "Bnoy test email", emailHtml("Your email connection works", [
      "This test email was sent from your Bnoy workspace using your saved mail settings.",
      "Order updates, delivery alerts and welcome emails will now go out automatically.",
    ]));
    return { ok: r.ok, message: r.ok ? `Test email sent to ${data.to}` : `Failed: ${r.error}` };
  });

/** Admin: send every queued email in the outbox now. Returns per-email results. */
export const sendOutboxNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const cfg = await getSmtp(context.supabase);
    if (!cfg) return { ok: false, message: "SMTP is not enabled or incomplete", sent: 0, failed: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendSmtpEmail, emailHtml } = await import("./smtp.server");

    const { data: rows } = await supabaseAdmin.from("email_outbox").select("id,kind,to_email,shipment_id").eq("status", "pending").order("created_at").limit(50);
    if (!rows?.length) return { ok: true, message: "No emails waiting", sent: 0, failed: 0 };

    const shipIds = [...new Set(rows.map((r) => r.shipment_id).filter(Boolean))] as string[];
    const { data: ships } = shipIds.length
      ? await supabaseAdmin.from("shipments").select("id,tracking_code,receiver_name,city").in("id", shipIds)
      : { data: [] };
    const ship = new Map((ships ?? []).map((s) => [s.id, s]));

    const KIND: Record<string, (t: string, n: string, c: string) => { subject: string; title: string; line: string }> = {
      dispatched: (t, n, c) => ({ subject: `Your parcel ${t} is on its way`, title: "Parcel dispatched", line: `Hi ${n}, your parcel ${t} has been dispatched and is heading to ${c}.` }),
      out_for_delivery: (t, n) => ({ subject: `Out for delivery: ${t}`, title: "Out for delivery", line: `Hi ${n}, your parcel ${t} is with the rider and will reach you today. Please keep your delivery OTP ready.` }),
      delivered: (t, n) => ({ subject: `Delivered: ${t}`, title: "Delivered", line: `Hi ${n}, your parcel ${t} was delivered. Thank you for choosing us.` }),
      failed: (t, n) => ({ subject: `Delivery attempt failed: ${t}`, title: "Delivery attempt failed", line: `Hi ${n}, we could not deliver your parcel ${t} today. We will try again soon.` }),
      welcome: (t, n) => ({ subject: "Welcome to Bnoy", title: "Welcome aboard", line: `Hi ${n}, your account is ready. Track and manage your parcels anytime.` }),
    };

    let sent = 0, failed = 0;
    for (const r of rows) {
      const s = r.shipment_id ? ship.get(r.shipment_id) : null;
      const t = s?.tracking_code ?? "", n = s?.receiver_name ?? "there", c = s?.city ?? "your city";
      const tpl = (KIND[r.kind] ?? KIND["dispatched"]!)(t, n, c);
      const origin = process.env["APP_ORIGIN"] ?? "https://sound-wave-scanner.lovable.app";
      const res = await sendSmtpEmail(cfg, r.to_email, tpl.subject, emailHtml(tpl.title, [tpl.line], t ? { label: "Track your parcel", url: `${origin}/track?code=${t}` } : undefined));
      if (res.ok) {
        sent++;
        await supabaseAdmin.from("email_outbox").update({ status: "sent", sent_at: new Date().toISOString(), error: null }).eq("id", r.id);
      } else {
        failed++;
        await supabaseAdmin.from("email_outbox").update({ status: "failed", attempts: 1, error: res.error ?? "unknown" }).eq("id", r.id);
      }
    }
    return { ok: failed === 0, message: `Sent ${sent}, failed ${failed}`, sent, failed };
  });

/** Rider: email the handover OTP to the receiving staff, and a receipt to the rider. */
export const sendHandoverOtpEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: h } = await supabaseAdmin.from("cod_handovers").select("id,code,from_user,to_user,expected_amount,shipment_count,status").eq("id", data.id).maybeSingle();
    if (!h || h.from_user !== context.userId) throw new Error("Handover not found");
    if (h.status !== "submitted") return { ok: false, message: "Already confirmed" };
    const { data: otp } = await supabaseAdmin.from("cod_handover_otps").select("code").eq("handover_id", h.id).maybeSingle();
    const { data: people } = await supabaseAdmin.from("profiles").select("id,full_name,email").in("id", [h.from_user, h.to_user].filter(Boolean) as string[]);
    const rider = people?.find((p) => p.id === h.from_user), staff = people?.find((p) => p.id === h.to_user);
    const cfg = await getSmtp(supabaseAdmin);
    if (!cfg) return { ok: false, message: "Email is not set up yet — staff can see the code in their Cash page" };
    const { sendSmtpEmail, emailHtml } = await import("./smtp.server");
    const amt = `₹${Number(h.expected_amount).toLocaleString("en-IN")}`;
    const out: string[] = [];
    if (staff?.email && otp) {
      const r = await sendSmtpEmail(cfg, staff.email, `Cash handover code ${otp.code} — ${amt} from ${rider?.full_name ?? "rider"}`, emailHtml("Cash handover code", [
        `${rider?.full_name ?? "A rider"} is handing you ${amt} for ${h.shipment_count} COD parcels (handover ${h.code}).`,
        `Count the cash first. Then tell the rider this code: <b style="font-size:24px;letter-spacing:4px">${otp.code}</b>`,
      ]));
      if (r.ok) out.push("staff");
    }
    if (rider?.email) {
      const r = await sendSmtpEmail(cfg, rider.email, `Handover ${h.code} started — ${amt}`, emailHtml("Handover started", [
        `You are handing ${amt} for ${h.shipment_count} parcels to ${staff?.full_name ?? "franchise staff"}.`,
        "Ask them for the 6-digit code after they count the cash, and enter it in your app.",
      ]));
      if (r.ok) out.push("rider");
    }
    return { ok: out.length > 0, message: out.length ? "Code emailed" : "No email on file — staff can see the code in their Cash page" };
  });
