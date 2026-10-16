import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/PublicShell";
import { Code, Endpoint, Fields } from "@/components/ApiDoc";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/docs/b2b")({
  head: () => pageHead("B2B order API", "Bulk business-to-business order creation, label sheets, bills and courier status sync with Bnoy Logistics OS."),
  component: B2BDocs,
});

function B2BDocs() {
  return (
    <PublicShell>
      <main className="public-container space-y-6 py-14">
        <p className="eyebrow">B2B</p>
        <h1 className="section-heading">B2B bulk orders</h1>
        <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
          Sellers, warehouses and courier aggregators push up to 100 orders per request using the same <Link to="/docs/api" className="text-primary">v1 API</Link>. Orders appear instantly in Shipments, ready for lots, rider assignment and A4 barcode sheets.
        </p>

        <Endpoint method="POST" path="/api/public/v1/shipments  (array body)">
          <p>Send an array. The whole batch is validated first — if one order is invalid, nothing is created and the first issues are returned.</p>
          <Code>{`[
  { "external_order_id": "INV-2026-0001", "sender_name": "Acme Warehouse",
    "receiver_name": "Retailer One", "receiver_phone": "9812345678",
    "receiver_address": "Plot 4, Industrial Area", "city": "Pune", "pincode": "411019",
    "weight_kg": 18.5, "cod_amount": 0, "notes": "Invoice INV-2026-0001 · 3 boxes" },
  { "external_order_id": "INV-2026-0002", ... }
]`}</Code>
        </Endpoint>

        <Endpoint method="MAP" path="Mapping from common courier B2B payloads">
          <Fields rows={[
            ["external_order_id", "order / invoice number", "Shown on bill and label"],
            ["sender_name", "pickup location / consignor", "Required"],
            ["receiver_*", "consignee name, phone, address", "Required"],
            ["weight_kg", "total weight", "Sum of all boxes, max 100"],
            ["cod_amount", "COD value", "0 for prepaid / credit B2B"],
            ["notes", "invoice ref, box count, e-way bill no.", "Free text, max 500"],
          ]} />
        </Endpoint>

        <Endpoint method="OUT" path="Status sharing with courier partners">
          <p>Every status change is pushed to your webhook URL, signed with HMAC-SHA256. Native syncing with Shiprocket, Delhivery or Ekart starts once their live account credentials are added under Courier partners.</p>
        </Endpoint>

        <Endpoint method="PRINT" path="Labels and bills">
          <p>From Shipments, choose <b>A4 sheet</b> for 4, 8 or 21 barcode labels per page, or open any order and press <b>Print bill</b>.</p>
        </Endpoint>
      </main>
    </PublicShell>
  );
}
