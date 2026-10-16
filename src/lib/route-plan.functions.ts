import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type RoutePlan = {
  summary: string;
  estimated_hours: number;
  stops: { tracking_code: string; order: number; reason: string; window: string }[];
  warnings: string[];
};

const SCHEMA = {
  type: "object", additionalProperties: false,
  required: ["summary", "estimated_hours", "stops", "warnings"],
  properties: {
    summary: { type: "string" },
    estimated_hours: { type: "number" },
    stops: { type: "array", items: { type: "object", additionalProperties: false, required: ["tracking_code", "order", "reason", "window"],
      properties: { tracking_code: { type: "string" }, order: { type: "integer" }, reason: { type: "string" }, window: { type: "string" } } } },
    warnings: { type: "array", items: { type: "string" } },
  },
};

export const planDeliveryRoute = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ hubId: z.string().uuid(), constraints: z.string().trim().max(1500).default("") }).parse(d))
  .handler(async ({ data, context }): Promise<RoutePlan & { hub: string; count: number }> => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) throw new Error("AI tools are available to admins only");
    const { data: hub } = await context.supabase.from("hubs").select("name, city, address, opens_at, closes_at").eq("id", data.hubId).maybeSingle();
    if (!hub) throw new Error("Hub not found");
    const { data: parcels, error } = await context.supabase.from("shipments")
      .select("tracking_code, receiver_address, city, pincode, weight_kg, service_level, payment_mode, cod_amount, fragile, attempt_count, promised_by, status")
      .eq("hub_id", data.hubId)
      .in("status", ["hub_received", "sorted", "assigned", "out_for_delivery", "reattempt"])
      .limit(40);
    if (error) throw new Error(error.message);
    if (!parcels?.length) throw new Error("No pending parcels at this hub right now.");
    const { streamJson } = await import("./ai-gateway.server");
    const plan = await streamJson<RoutePlan>({
      name: "route_plan", schema: SCHEMA,
      instructions: "You are an Indian last-mile dispatch planner. Order the given pending parcels into one practical delivery sequence from the hub. Prioritise express/same-day, promised deadlines, reattempts and high COD; cluster by pincode/locality to cut travel. Respect the dispatcher's constraints. Use only the tracking codes given. window is a suggested time slot like '10:00-11:00'. Keep reasons short.",
      input: `Hub: ${JSON.stringify(hub)}\nPending parcels: ${JSON.stringify(parcels)}\nDispatcher constraints: ${data.constraints || "none"}`,
    });
    const valid = new Set(parcels.map((p) => p.tracking_code));
    plan.stops = plan.stops.filter((s) => valid.has(s.tracking_code)).sort((a, b) => a.order - b.order);
    return { ...plan, hub: hub.name, count: parcels.length };
  });
