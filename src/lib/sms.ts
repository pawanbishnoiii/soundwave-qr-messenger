export type SmsProvider = "fast2sms" | "2factor" | "msg91" | "custom";
export type SmsSettings = { enabled?: boolean; provider?: SmsProvider; api_key?: string; url_template?: string; template_id?: string; sender_id?: string };

/** Sends a one-time code through the configured provider. Returns the provider response. */
export async function sendOtpVia(s: SmsSettings, phone: string, code: string): Promise<{ ok: boolean; status: number; body: string }> {
  let r: Response;
  if (s.provider === "fast2sms" && s.api_key) {
    r = await fetch("https://www.fast2sms.com/dev/bulkV2", { method: "POST", headers: { authorization: s.api_key, "Content-Type": "application/json" }, body: JSON.stringify({ route: "otp", variables_values: code, numbers: phone }) });
  } else if (s.provider === "2factor" && s.api_key) {
    r = await fetch(`https://2factor.in/API/V1/${encodeURIComponent(s.api_key)}/SMS/+91${phone}/${code}${s.template_id ? `/${encodeURIComponent(s.template_id)}` : ""}`);
  } else if (s.provider === "msg91" && s.api_key && s.template_id) {
    r = await fetch(`https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(s.template_id)}&mobile=91${phone}&otp=${code}`, { method: "POST", headers: { authkey: s.api_key, "Content-Type": "application/json" }, body: "{}" });
  } else if (s.provider === "custom" && s.url_template) {
    r = await fetch(s.url_template.replace("{phone}", encodeURIComponent(phone)).replace("{otp}", code));
  } else return { ok: false, status: 0, body: "Gateway details are incomplete" };
  return { ok: r.ok, status: r.status, body: (await r.text()).slice(0, 300) };
}
