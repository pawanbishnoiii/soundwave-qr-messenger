import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/PublicShell";
import { Code, Endpoint, Fields } from "@/components/ApiDoc";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/docs/api")({
  head: () => pageHead("API documentation", "Create orders, read shipment status, track parcels and receive signed webhooks from Bnoy Logistics OS."),
  component: ApiDocs,
});

const ORDER_FIELDS: [string, string, string][] = [
  ["receiver_name", "string", "Required, 2–120 chars"],
  ["receiver_phone", "string", "Required, 8–16 digits"],
  ["receiver_address", "string", "Required"],
  ["city", "string", "Required"],
  ["pincode", "string", "Optional, 6 digits"],
  ["sender_name", "string", "Required"],
  ["weight_kg", "number", "Default 0.5, max 100"],
  ["cod_amount", "number", "0 = prepaid"],
  ["external_order_id", "string", "Your order reference (shown on the bill)"],
  ["notes", "string", "Optional, max 500"],
];

function ApiDocs() {
  return (
    <PublicShell>
      <main className="public-container space-y-6 py-14">
        <p className="eyebrow">Developers</p>
        <h1 className="section-heading">Bnoy API v1</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          Admins create API keys under <b>API &amp; webhooks</b>. Send the key as a bearer token. Keys are stored only as hashes — copy yours when it is created. For bulk business orders see the <Link to="/docs/b2b" className="text-primary">B2B guide</Link>.
        </p>
        <Code>{`Authorization: Bearer bnoy_live_<48 hex chars>\nContent-Type: application/json`}</Code>

        <Endpoint method="POST" path="/api/public/v1/shipments">
          <p>Create one order (object) or up to 100 orders (array). Needs scope <code>shipments:write</code>. Each order gets a tracking code, barcode label and printable bill.</p>
          <Fields rows={ORDER_FIELDS} />
          <Code>{`curl -X POST $BASE/api/public/v1/shipments \\
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \\
  -d '{"receiver_name":"Asha Verma","receiver_phone":"9876543210",
       "receiver_address":"12 MG Road","city":"Jaipur","pincode":"302001",
       "sender_name":"Acme Store","weight_kg":1.2,"cod_amount":499,
       "external_order_id":"ACME-1001"}'`}</Code>
          <p>Response <b>201</b>: <code>{`{ "data": [ { "id", "tracking_code", "status", ... } ] }`}</code></p>
        </Endpoint>

        <Endpoint method="GET" path="/api/public/v1/shipments?status=delivered&limit=50">
          <p>List your orders (max 200). Needs scope <code>shipments:read</code>.</p>
        </Endpoint>

        <Endpoint method="GET" path="/api/public/track/{tracking_code}">
          <p>Public tracking — no key needed. Returns status and timeline only, never customer contact details.</p>
        </Endpoint>

        <Endpoint method="WEBHOOK" path="Your URL">
          <p>Events: <code>shipment.created</code>, <code>shipment.status_changed</code>, <code>return.created</code>, <code>return.status_changed</code>. Retries with back-off; every attempt is logged.</p>
          <p>Verify the <code>x-bnoy-signature</code> header: HMAC-SHA256 of the raw body with your endpoint secret.</p>
          <Code>{`const ok = crypto.createHmac("sha256", SECRET).update(rawBody).digest("hex") === signature;`}</Code>
        </Endpoint>

        <Endpoint method="ERRORS" path="Status codes">
          <p>400 invalid body · 401 bad or revoked key · 403 missing scope · 413 more than 100 orders · 500 server error.</p>
        </Endpoint>
      </main>
    </PublicShell>
  );
}
