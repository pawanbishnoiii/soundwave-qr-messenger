// Fails if any migration after the baseline drops, truncates or re-creates one of the existing tables.
import { readdirSync, readFileSync } from "node:fs";
const PROTECTED = ["api_keys","audit_log","cod_handovers","courier_partners","delivery_routes","finance_ledger","hubs","integration_events","lots","merchants","partner_orders","payout_bonuses","payout_settings","profiles","providers","return_events","return_photos","return_requests","rider_ratings","rider_wallet_txns","shipment_events","shipments","user_roles","vehicles","webhook_deliveries","webhook_endpoints","webhook_outbox"];
const dir = "drizzle/migrations";
const problems: string[] = [];
for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql") && !f.startsWith("0000_")).sort()) {
  const sql = readFileSync(`${dir}/${f}`, "utf8").replace(/--.*$/gm, "").toLowerCase();
  for (const t of PROTECTED) {
    const n = `(?:public\\.)?"?${t}"?\\b`;
    if (new RegExp(`drop\\s+table\\s+(?:if\\s+exists\\s+)?[^;]*${n}`).test(sql)) problems.push(`${f}: drops ${t}`);
    if (new RegExp(`truncate\\s+(?:table\\s+)?[^;]*${n}`).test(sql)) problems.push(`${f}: truncates ${t}`);
    if (new RegExp(`create\\s+table\\s+(?!if\\s+not\\s+exists)${n}`).test(sql)) problems.push(`${f}: re-creates ${t}`);
  }
}
if (problems.length) { console.error("Unsafe migrations:\n" + problems.join("\n")); process.exit(1); }
console.log(`Migration safety check passed (${PROTECTED.length} tables protected).`);
