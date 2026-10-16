import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" });
  if (error || !data) throw new Error("Admin access required");
}
const rand = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n))).map((b) => b.toString(16).padStart(2, "0")).join("");

export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ name: z.string().trim().min(2).max(80) }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { sha256Hex } = await import("./webhooks.server");
    const key = `bnoy_live_${rand(24)}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("api_keys").insert({ name: data.name, prefix: key.slice(0, 14), key_hash: await sha256Hex(key), created_by: context.userId });
    if (error) throw new Error("Could not create key");
    return { key };
  });

export const createWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({
    name: z.string().trim().min(2).max(80),
    url: z.string().url().startsWith("https://").max(500),
    events: z.array(z.enum(["shipment.created", "shipment.updated", "return.updated"])).min(1),
  }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const secret = `whsec_${rand(24)}`;
    const { error } = await context.supabase.from("webhook_endpoints").insert({ ...data, secret, created_by: context.userId });
    if (error) throw new Error("Could not save webhook");
    return { secret };
  });

export const testWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { dispatchEvent } = await import("./webhooks.server");
    const r = await dispatchEvent("ping", { message: "Test event from Bnoy" }, data.id);
    return r[0] ?? { ok: false, status: null };
  });

/** Admin: deliver queued webhooks right now instead of waiting for the next scheduled run. */
export const flushWebhooks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { processOutbox } = await import("./webhooks.server");
    return processOutbox();
  });

/** Admin: re-queue a failed delivery. */
export const retryWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((v: unknown) => z.object({ id: z.string().uuid() }).parse(v))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("webhook_outbox").update({ status: "pending", next_attempt_at: new Date().toISOString(), max_attempts: 6, attempts: 0 }).eq("id", data.id).in("status", ["failed", "cancelled"]);
    if (error) throw new Error("Could not retry");
    return { ok: true };
  });
