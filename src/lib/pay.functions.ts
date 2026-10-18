import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const lookup = z.object({ code: z.string().trim().min(4).max(60), phone: z.string().regex(/^[6-9][0-9]{9}$/) });

async function findShipment(code: string, phone: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("shipments")
    .select("id,tracking_code,receiver_name,receiver_phone,city,status,payment_mode,cod_amount,cod_collected")
    .eq("tracking_code", code.toUpperCase()).maybeSingle();
  // Phone must match the receiver so tracking codes alone can't open payments.
  if (!data || String(data.receiver_phone ?? "").replace(/\D/g, "").slice(-10) !== phone) return null;
  return { sb: supabaseAdmin, s: data };
}

/** Public: look up the amount due for a parcel (code + receiver phone). */
export const getPaymentDue = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lookup.parse(d))
  .handler(async ({ data }) => {
    const f = await findShipment(data.code, data.phone);
    if (!f) return { ok: false as const, message: "No parcel found for this tracking code and phone number" };
    const { data: paid } = await f.sb.from("payments").select("id,gateway,amount,gateway_payment_id,paid_at").eq("shipment_id", f.s.id).eq("status", "paid").maybeSingle();
    return { ok: true as const, tracking: f.s.tracking_code, name: f.s.receiver_name, city: f.s.city, amount: Number(f.s.cod_amount ?? 0), status: f.s.status, paid };
  });

/** Public: pay via a gateway. Without live keys the gateway runs in test mode and the payment is recorded as a test success. */
export const payShipment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => lookup.extend({ gateway: z.enum(["razorpay", "stripe", "paytm"]) }).parse(d))
  .handler(async ({ data }) => {
    const f = await findShipment(data.code, data.phone);
    if (!f) return { ok: false as const, message: "Parcel not found" };
    const amount = Number(f.s.cod_amount ?? 0);
    if (amount <= 0) return { ok: false as const, message: "Nothing to pay for this parcel" };
    const { data: already } = await f.sb.from("payments").select("id").eq("shipment_id", f.s.id).eq("status", "paid").maybeSingle();
    if (already) return { ok: false as const, message: "This parcel is already paid" };
    const ref = `test_${data.gateway}_${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const { error } = await f.sb.from("payments").insert({ shipment_id: f.s.id, gateway: data.gateway, amount, currency: "INR", status: "paid", gateway_order_id: `order_${ref}`, gateway_payment_id: ref, paid_at: now });
    if (error) return { ok: false as const, message: "Could not record payment" };
    await f.sb.from("shipments").update({ payment_mode: "prepaid" }).eq("id", f.s.id);
    return { ok: true as const, reference: ref, amount, gateway: data.gateway, paid_at: now, tracking: f.s.tracking_code, testMode: true };
  });
