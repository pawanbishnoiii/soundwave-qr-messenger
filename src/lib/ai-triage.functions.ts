import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TriageResult = {
  category: string;
  urgency: "low" | "medium" | "high";
  confidence: number;
  summary: string;
  next_action: string;
  steps: string[];
  customer_message: string;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "urgency", "confidence", "summary", "next_action", "steps", "customer_message"],
  properties: {
    category: {
      type: "string",
      enum: ["Customer unavailable", "Wrong or incomplete address", "Customer refused", "Damaged parcel", "COD / payment issue", "Delayed in transit", "Rider issue", "Lost or missing", "Other"],
    },
    urgency: { type: "string", enum: ["low", "medium", "high"] },
    confidence: { type: "number" },
    summary: { type: "string" },
    next_action: { type: "string" },
    steps: { type: "array", items: { type: "string" } },
    customer_message: { type: "string" },
  },
};

export const triageDeliveryIssue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ shipmentId: z.string().uuid(), description: z.string().trim().min(5).max(2000) }).parse(d))
  .handler(async ({ data, context }): Promise<TriageResult> => {
    const { data: s, error } = await context.supabase
      .from("shipments")
      .select("tracking_code, status, city, cod_amount, cod_collected, created_at, delivered_at, rider_id, notes")
      .eq("id", data.shipmentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!s) throw new Error("Shipment not found or not visible to you");
    const { data: events } = await context.supabase
      .from("shipment_events")
      .select("status, note, created_at")
      .eq("shipment_id", data.shipmentId)
      .order("created_at", { ascending: false })
      .limit(10);

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low" },
        instructions:
          "You are an Indian last-mile logistics operations expert. Classify the delivery problem using the shipment status and history, then suggest the single most useful next action for the ops team. Keep text short and practical. Confidence is 0-1. customer_message is a short polite SMS/WhatsApp text to the receiver.",
        input: `Shipment: ${JSON.stringify({ ...s, rider_assigned: !!s.rider_id, rider_id: undefined })}\nRecent events: ${JSON.stringify(events ?? [])}\nProblem description from ops team: ${data.description}`,
        text: { format: { type: "json_schema", name: "triage", strict: true, schema: SCHEMA } },
      }),
    });
    if (!res.ok || !res.body) {
      if (res.status === 429) throw new Error("AI is busy right now. Please try again in a minute.");
      if (res.status === 402) throw new Error("AI credits are used up. Add credits to keep using AI suggestions.");
      throw new Error(`AI request failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload);
          if (ev.type === "response.output_text.delta") text += ev.delta ?? "";
          if (ev.type === "response.refusal.delta" || ev.type === "response.failed") throw new Error("AI could not analyse this issue.");
        } catch (e) {
          if (e instanceof Error && e.message.startsWith("AI")) throw e;
        }
      }
    }
    try {
      return JSON.parse(text) as TriageResult;
    } catch {
      throw new Error("AI returned an unreadable answer. Please try again.");
    }
  });
