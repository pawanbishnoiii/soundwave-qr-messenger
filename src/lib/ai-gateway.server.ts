// Server-only: streams a strict-JSON answer from the AI Gateway Responses API.
export async function streamJson<T>(opts: { instructions: string; input: string; name: string; schema: object }): Promise<T> {
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
      instructions: opts.instructions,
      input: opts.input,
      text: { format: { type: "json_schema", name: opts.name, strict: true, schema: opts.schema } },
    }),
  });
  if (!res.ok || !res.body) {
    if (res.status === 429) throw new Error("AI is busy right now. Please try again in a minute.");
    if (res.status === 402) throw new Error("AI credits are used up. Add credits to keep using AI suggestions.");
    if (res.status === 403) throw new Error("AI access is blocked for this workspace.");
    throw new Error(`AI request failed (${res.status})`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "";
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
      let ev: { type?: string; delta?: string } | null = null;
      try { ev = JSON.parse(payload); } catch { continue; }
      if (ev?.type === "response.output_text.delta") text += ev.delta ?? "";
      if (ev?.type === "response.refusal.delta" || ev?.type === "response.failed") throw new Error("AI could not answer this request.");
    }
  }
  try { return JSON.parse(text) as T; } catch { throw new Error("AI returned an unreadable answer. Please try again."); }
}
