import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Authorization, Content-Type" };
const orderSchema = z.object({
  receiver_name: z.string().trim().min(2).max(120),
  receiver_phone: z.string().trim().regex(/^[0-9+\- ]{8,16}$/),
  receiver_address: z.string().trim().min(5).max(400),
  city: z.string().trim().min(2).max(80),
  pincode: z.string().trim().regex(/^[0-9]{6}$/).optional(),
  sender_name: z.string().trim().min(2).max(120),
  weight_kg: z.number().positive().max(100).default(0.5),
  cod_amount: z.number().min(0).max(500000).default(0),
  external_order_id: z.string().trim().max(80).optional(),
  notes: z.string().max(500).optional(),
});
const COLS = "id,tracking_code,status,receiver_name,city,cod_amount,external_order_id,created_at,updated_at,delivered_at";

async function auth(request: Request) {
  const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!/^bnoy_live_[a-f0-9]{48}$/.test(key)) return null;
  const { sha256Hex } = await import("@/lib/webhooks.server");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("api_keys").select("id,created_by,scopes,revoked_at").eq("key_hash", await sha256Hex(key)).maybeSingle();
  if (!data || data.revoked_at) return null;
  await supabaseAdmin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);
  return { ...data, db: supabaseAdmin };
}
const unauthorized = () => Response.json({ error: "Invalid or revoked API key" }, { status: 401, headers: cors });

export const Route = createFileRoute("/api/public/v1/shipments")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const a = await auth(request); if (!a) return unauthorized();
        if (!a.scopes.includes("shipments:read")) return Response.json({ error: "Missing scope" }, { status: 403, headers: cors });
        const url = new URL(request.url);
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 50) || 50, 1), 200);
        let q = a.db.from("shipments").select(COLS).eq("created_by", a.created_by).order("created_at", { ascending: false }).limit(limit);
        const status = url.searchParams.get("status"); if (status && /^[a-z_]{3,20}$/.test(status)) q = q.eq("status", status as never);
        const { data, error } = await q;
        if (error) return Response.json({ error: "Lookup failed" }, { status: 500, headers: cors });
        return Response.json({ data }, { headers: cors });
      },
      POST: async ({ request }) => {
        const a = await auth(request); if (!a) return unauthorized();
        if (!a.scopes.includes("shipments:write")) return Response.json({ error: "Missing scope" }, { status: 403, headers: cors });
        let body: unknown; try { body = await request.json(); } catch { return Response.json({ error: "Invalid JSON" }, { status: 400, headers: cors }); }
        const list = Array.isArray(body) ? body : [body];
        if (list.length > 100) return Response.json({ error: "Max 100 orders per request" }, { status: 413, headers: cors });
        const parsed = z.array(orderSchema).safeParse(list);
        if (!parsed.success) return Response.json({ error: "Invalid order", issues: parsed.error.issues.slice(0, 5) }, { status: 400, headers: cors });
        const { data, error } = await a.db.from("shipments").insert(parsed.data.map((o) => ({ ...o, pincode: o.pincode ?? null, external_order_id: o.external_order_id ?? null, notes: o.notes ?? null, created_by: a.created_by }))).select(COLS);
        if (error) return Response.json({ error: "Could not create shipments" }, { status: 500, headers: cors });
        // shipment.created webhooks are queued by a database trigger and delivered by the outbox job.
        return Response.json({ data }, { status: 201, headers: cors });
      },
    },
  },
});
