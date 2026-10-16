import QRCode from "qrcode";
import JsBarcode from "jsbarcode";
import type { Shipment } from "./status";
import { trackUrl } from "./shipments";

const esc = (v: string | number | null | undefined) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export function barcodeDataUrl(code: string) {
  const canvas = document.createElement("canvas");
  JsBarcode(canvas, code, { format: "CODE128", width: 2, height: 60, displayValue: false, margin: 0 });
  return canvas.toDataURL("image/png");
}

/** Opens a print window with one 4x6-style label per shipment (QR + Code128 barcode). */
export async function printLabels(list: Shipment[]) {
  const w = window.open("", "_blank", "width=520,height=720");
  if (!w) throw new Error("Allow pop-ups to print labels");
  const items = await Promise.all(
    list.map(async (s) => ({
      s,
      qr: await QRCode.toDataURL(trackUrl(s.tracking_code), { width: 300, margin: 0 }),
      bar: barcodeDataUrl(s.tracking_code),
    })),
  );
  w.document.write(`<html><head><title>Labels (${list.length})</title><style>
    *{box-sizing:border-box}body{font-family:system-ui,sans-serif;margin:0;padding:12px;color:#111}
    .l{border:2px solid #111;border-radius:8px;padding:14px;width:380px;margin:0 auto 14px;page-break-after:always}
    .h{display:flex;justify-content:space-between;font-weight:800;font-size:12px;letter-spacing:.1em;border-bottom:1px dashed #111;padding-bottom:6px}
    .bar{width:100%;height:60px;margin-top:10px}.c{font:700 18px monospace;text-align:center;margin:4px 0 8px}
    .g{display:flex;gap:10px}.r{font-size:12px;line-height:1.45;flex:1}
    .cod{margin-top:8px;padding:6px 10px;background:#111;color:#fff;display:inline-block;border-radius:5px;font-weight:800}
    @media print{body{padding:0}.l{margin:0 auto}}
  </style></head><body>${items
    .map(
      ({ s, qr, bar }) => `<div class="l"><div class="h"><span>ROUTEFLOW OS</span><span>${esc(s.city).toUpperCase()}</span></div>
      <img class="bar" src="${bar}"/><div class="c">${esc(s.tracking_code)}</div>
      <div class="g"><img src="${qr}" width="110" height="110"/><div class="r">
        <b>TO:</b> ${esc(s.receiver_name)}<br/>${esc(s.receiver_phone)}<br/>${esc(s.receiver_address)}, ${esc(s.city)} ${esc(s.pincode)}
        <br/><b>FROM:</b> ${esc(s.sender_name)}<br/>Wt ${esc(s.weight_kg)} kg${s.is_demo ? " · DEMO" : ""}
      </div></div>
      <div class="cod">${Number(s.cod_amount) > 0 ? `COD ₹${Number(s.cod_amount).toLocaleString("en-IN")}` : "PREPAID"}</div></div>`,
    )
    .join("")}<script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}

export type SheetLayout = { cols: number; rows: number; name: string };
export const SHEET_LAYOUTS: SheetLayout[] = [
  { name: "A4 · 2×4 (8 labels)", cols: 2, rows: 4 },
  { name: "A4 · 3×7 (21 labels)", cols: 3, rows: 7 },
  { name: "A4 · 2×2 (4 labels)", cols: 2, rows: 2 },
];

/** Prints barcode labels tiled on A4 sheets (cols × rows per page). */
export function printLabelSheet(list: Shipment[], layout: SheetLayout) {
  const w = window.open("", "_blank", "width=820,height=900");
  if (!w) throw new Error("Allow pop-ups to print labels");
  const per = layout.cols * layout.rows;
  const pages: Shipment[][] = [];
  for (let i = 0; i < list.length; i += per) pages.push(list.slice(i, i + per));
  const small = layout.rows > 4;
  w.document.write(`<html><head><title>Label sheet (${list.length})</title><style>
    @page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;font-family:system-ui,sans-serif;color:#111}
    .p{display:grid;grid-template-columns:repeat(${layout.cols},1fr);grid-template-rows:repeat(${layout.rows},1fr);gap:3mm;height:279mm;page-break-after:always}
    .c{border:1px dashed #999;padding:${small ? "2mm" : "4mm"};overflow:hidden;font-size:${small ? "8px" : "11px"};display:flex;flex-direction:column;justify-content:center}
    .c img{width:100%;height:${small ? "28px" : "52px"}}.t{font:700 ${small ? "10px" : "14px"} monospace;text-align:center}
  </style></head><body>${pages
    .map((pg) => `<div class="p">${pg
      .map((s) => `<div class="c"><img src="${barcodeDataUrl(s.tracking_code)}"/><div class="t">${esc(s.tracking_code)}</div>
        <div><b>${esc(s.receiver_name)}</b> · ${esc(s.receiver_phone)}</div><div>${esc(s.city)} ${esc(s.pincode)}</div>
        <div><b>${Number(s.cod_amount) > 0 ? `COD ₹${Number(s.cod_amount).toLocaleString("en-IN")}` : "PREPAID"}</b> · ${esc(s.weight_kg)} kg</div></div>`)
      .join("")}</div>`)
    .join("")}<script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}

/** Prints a simple tax-invoice style bill for an order. */
export async function printInvoice(s: Shipment) {
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) throw new Error("Allow pop-ups to print the bill");
  const amt = Number(s.cod_amount);
  w.document.write(`<html><head><title>Bill ${esc(s.tracking_code)}</title><style>
    body{font-family:system-ui,sans-serif;max-width:680px;margin:24px auto;color:#111}h1{margin:0;font-size:22px}
    table{width:100%;border-collapse:collapse;margin-top:18px}td,th{border:1px solid #ccc;padding:8px;text-align:left;font-size:13px}
    .r{text-align:right}.m{color:#555;font-size:12px}img{height:50px}
  </style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:center"><div><h1>BNOY LOGISTICS</h1><div class="m">Delivery bill / invoice</div></div><img src="${barcodeDataUrl(s.tracking_code)}"/></div>
    <p class="m">Bill no: ${esc(s.tracking_code)} · Date: ${new Date(s.created_at).toLocaleDateString("en-IN")}${s.external_order_id ? ` · Order ref: ${esc(s.external_order_id)}` : ""}${s.partner_awb ? ` · AWB: ${esc(s.partner_awb)}` : ""}</p>
    <table><tr><th>From</th><th>Bill to</th></tr><tr><td>${esc(s.sender_name)}<br/>${esc(s.sender_phone)}</td>
    <td>${esc(s.receiver_name)}<br/>${esc(s.receiver_phone)}<br/>${esc(s.receiver_address)}, ${esc(s.city)} ${esc(s.pincode)}</td></tr></table>
    <table><tr><th>Description</th><th>Weight</th><th class="r">Amount</th></tr>
    <tr><td>Parcel ${esc(s.tracking_code)}${s.notes ? ` — ${esc(s.notes.split("\n")[0])}` : ""}</td><td>${esc(s.weight_kg)} kg</td><td class="r">₹${amt.toLocaleString("en-IN")}</td></tr>
    <tr><th colspan="2" class="r">${amt > 0 ? "Cash on delivery" : "Prepaid"} total</th><th class="r">₹${amt.toLocaleString("en-IN")}</th></tr></table>
    <p class="m">Status: ${esc(s.status)}. Computer-generated bill.</p>
    <script>onload=()=>setTimeout(()=>print(),300)</script></body></html>`);
  w.document.close();
}
