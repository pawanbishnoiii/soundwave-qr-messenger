// Server-only: outbound webhook delivery with HMAC-SHA256 signatures, retries and delivery logs.
async function hmac(secret: string, body: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sha256Hex(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Endpoint = { id: string; url: string; secret: string };

async function send(ep: Endpoint, event: string, payload: Record<string, unknown>, attempt: number, outboxId: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const body = JSON.stringify(payload);
  let status: number | null = null; let error: string | null = null; let responseBody: string | null = null;
  const t0 = Date.now();
  try {
    const res = await fetch(ep.url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Bnoy-Event": event, "X-Bnoy-Delivery": String(payload["id"] ?? ""), "X-Bnoy-Attempt": String(attempt), "X-Bnoy-Signature": `sha256=${await hmac(ep.secret, body)}` },
      body, signal: AbortSignal.timeout(8000),
    });
    status = res.status;
    responseBody = (await res.text().catch(() => "")).slice(0, 500);
  } catch (e) { error = e instanceof Error ? e.message.slice(0, 200) : "Delivery failed"; }
  const ok = status !== null && status >= 200 && status < 300;
  if (!ok && !error) error = `HTTP ${status}`;
  await supabaseAdmin.from("webhook_deliveries").insert({ endpoint_id: ep.id, event, status_code: status, ok, error, attempt, outbox_id: outboxId, duration_ms: Date.now() - t0, request_body: payload as never, response_body: responseBody });
  await supabaseAdmin.from("webhook_endpoints").update({ last_status: status, last_delivery_at: new Date().toISOString() }).eq("id", ep.id);
  return { ok, status, error };
}

/** Immediate one-off send (used by the "Test" button). */
export async function dispatchEvent(event: string, data: unknown, onlyEndpointId?: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let q = supabaseAdmin.from("webhook_endpoints").select("id,url,secret,events").eq("active", true);
  if (onlyEndpointId) q = q.eq("id", onlyEndpointId);
  const { data: endpoints } = await q;
  const results: { id: string; ok: boolean; status: number | null }[] = [];
  for (const ep of endpoints ?? []) {
    if (!onlyEndpointId && !ep.events.includes(event)) continue;
    const r = await send(ep, event, { id: crypto.randomUUID(), event, created_at: new Date().toISOString(), data }, 1, null);
    results.push({ id: ep.id, ok: r.ok, status: r.status });
  }
  return results;
}

/** Backoff: 1m, 5m, 15m, 1h, 6h. */
const BACKOFF_MIN = [1, 5, 15, 60, 360];

/** Deliver queued events that are due. Called by the scheduled job. */
export async function processOutbox(limit = 50) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: due } = await supabaseAdmin.from("webhook_outbox")
    .select("id,endpoint_id,event,payload,attempts,max_attempts")
    .eq("status", "pending").lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at").limit(limit);
  let delivered = 0, failed = 0;
  for (const job of due ?? []) {
    // claim the row so overlapping runs don't double-send
    const { data: claimed } = await supabaseAdmin.from("webhook_outbox").update({ status: "sending" }).eq("id", job.id).eq("status", "pending").select("id");
    if (!claimed?.length) continue;
    const { data: ep } = await supabaseAdmin.from("webhook_endpoints").select("id,url,secret,active").eq("id", job.endpoint_id).maybeSingle();
    if (!ep || !ep.active) { await supabaseAdmin.from("webhook_outbox").update({ status: "cancelled", last_error: "Endpoint inactive" }).eq("id", job.id); continue; }
    const attempt = job.attempts + 1;
    const r = await send(ep, job.event, job.payload as Record<string, unknown>, attempt, job.id);
    if (r.ok) {
      delivered++;
      await supabaseAdmin.from("webhook_outbox").update({ status: "delivered", attempts: attempt, delivered_at: new Date().toISOString(), last_error: null }).eq("id", job.id);
    } else {
      failed++;
      const giveUp = attempt >= job.max_attempts;
      const wait = BACKOFF_MIN[Math.min(attempt - 1, BACKOFF_MIN.length - 1)]!;
      await supabaseAdmin.from("webhook_outbox").update({ status: giveUp ? "failed" : "pending", attempts: attempt, last_error: r.error, next_attempt_at: new Date(Date.now() + wait * 60_000).toISOString() }).eq("id", job.id);
    }
  }
  return { processed: due?.length ?? 0, delivered, failed };
}
