// Minimal SMTP client for the Cloudflare Worker runtime (no Node APIs).
// Supports port 465 (implicit TLS) and 587/25 (STARTTLS) with AUTH LOGIN.
import { connect, type Socket } from "cloudflare:sockets";

export type SmtpConfig = {
  host: string;
  port: number;
  user: string;
  pass: string;
  fromName?: string;
};

class SmtpConn {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private buf = "";
  private dec = new TextDecoder();
  private enc = new TextEncoder();

  constructor(private sock: Socket) {
    this.reader = sock.readable.getReader();
    this.writer = sock.writable.getWriter();
  }

  private async fill() {
    const { value, done } = await this.reader.read();
    if (done) throw new Error("Connection closed by mail server");
    this.buf += this.dec.decode(value, { stream: true });
  }

  private async line(): Promise<string> {
    for (;;) {
      const i = this.buf.indexOf("\r\n");
      if (i >= 0) {
        const l = this.buf.slice(0, i);
        this.buf = this.buf.slice(i + 2);
        return l;
      }
      await this.fill();
    }
  }

  /** Read a (possibly multi-line) reply; returns the final code and full text. */
  async reply(): Promise<{ code: number; text: string }> {
    let text = "";
    for (;;) {
      const l = await this.line();
      text += l + "\n";
      const m = /^(\d{3})([ -])/.exec(l);
      if (m && m[2] === " ") return { code: Number(m[1]), text };
      if (!m) return { code: 0, text };
    }
  }

  async cmd(c: string, expect: number[]): Promise<string> {
    await this.writer.write(this.enc.encode(c + "\r\n"));
    const r = await this.reply();
    if (!expect.includes(r.code)) throw new Error(`SMTP ${r.code}: ${r.text.trim().slice(0, 200)}`);
    return r.text;
  }

  async upgrade() {
    // After STARTTLS: re-wrap the socket streams
    const tls = this.sock.startTls();
    this.sock = tls;
    this.reader.releaseLock();
    this.writer.releaseLock();
    this.reader = tls.readable.getReader();
    this.writer = tls.writable.getWriter();
    this.buf = "";
  }

  async close() {
    try { await this.writer.close(); } catch { /* ignore */ }
  }
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s)));
const encHeader = (s: string) => (/[^\x20-\x7e]/.test(s) ? `=?UTF-8?B?${b64(s)}?=` : s);

export async function sendSmtpEmail(
  cfg: SmtpConfig,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; error?: string }> {
  let conn: SmtpConn | null = null;
  try {
    const implicitTls = cfg.port === 465;
    const sock = connect(
      { hostname: cfg.host, port: cfg.port },
      { secureTransport: implicitTls ? "on" : "starttls", allowHalfOpen: false },
    );
    conn = new SmtpConn(sock);
    const greet = await conn.reply();
    if (greet.code !== 220) throw new Error(`Mail server refused connection: ${greet.text.slice(0, 120)}`);

    const ehloName = cfg.host.split(".").slice(-2).join(".");
    await conn.cmd(`EHLO ${ehloName}`, [250]);
    if (!implicitTls) {
      await conn.cmd("STARTTLS", [220]);
      await conn.upgrade();
      await conn.cmd(`EHLO ${ehloName}`, [250]);
    }
    await conn.cmd("AUTH LOGIN", [334]);
    await conn.cmd(b64(cfg.user), [334]);
    await conn.cmd(b64(cfg.pass), [235]);
    await conn.cmd(`MAIL FROM:<${cfg.user}>`, [250]);
    await conn.cmd(`RCPT TO:<${to}>`, [250, 251]);
    await conn.cmd("DATA", [354]);

    const from = cfg.fromName ? `"${encHeader(cfg.fromName)}" <${cfg.user}>` : cfg.user;
    const msg = [
      `From: ${from}`,
      `To: ${to}`,
      `Subject: ${encHeader(subject)}`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      b64(html),
      ".",
    ].join("\r\n");
    await conn.cmd(msg, [250]);
    await conn.cmd("QUIT", [221]).catch(() => "");
    await conn.close();
    return { ok: true };
  } catch (e) {
    try { await conn?.close(); } catch { /* ignore */ }
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Simple branded HTML email body. */
export function emailHtml(title: string, lines: string[], cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif">
  <div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e9ef">
    <div style="background:#0b1f3a;padding:20px 24px"><span style="color:#c8f04a;font-weight:bold;font-size:18px">Bnoy Logistics</span></div>
    <div style="padding:24px">
      <h1 style="margin:0 0 12px;font-size:20px;color:#0b1f3a">${title}</h1>
      ${lines.map((l) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#3c4657">${l}</p>`).join("")}
      ${cta ? `<p style="margin:20px 0 0"><a href="${cta.url}" style="display:inline-block;background:#0b1f3a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:bold">${cta.label}</a></p>` : ""}
    </div>
    <div style="padding:14px 24px;background:#f4f6f8;font-size:11px;color:#8a94a6">You received this because a parcel is linked to your email address.</div>
  </div></body></html>`;
}
