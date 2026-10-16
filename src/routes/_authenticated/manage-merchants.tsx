import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable, type Field } from "@/components/CrudPage";
import { useMe } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { opts, useHubOptions, useRiderOptions } from "@/lib/manage";

export const Route = createFileRoute("/_authenticated/manage-merchants")({
  head: () => pageHead("Merchants", "Merchant accounts, pickup addresses and rate cards"),
  component: Page,
});

function Page() {
  const { role } = useMe();
  const hubs = useHubOptions();
  const riders = useRiderOptions();
  void riders; void hubs; void opts;
  const fields: Field[] = [
    { key: "name", label: "Name", required: true },
    { key: "legal_name", label: "Legal name", hideInTable: true },
    { key: "gstin", label: "GSTIN", hideInTable: true },
    { key: "contact_name", label: "Contact" },
    { key: "contact_phone", label: "Phone" },
    { key: "contact_email", label: "Email", hideInTable: true },
    { key: "pickup_address", label: "Pickup address", required: true, hideInTable: true },
    { key: "pickup_city", label: "City" },
    { key: "pickup_pincode", label: "Pincode", hideInTable: true },
    { key: "default_hub_id", label: "Default hub", type: "select", options: hubs, hideInTable: true },
    { key: "base_rate", label: "Base ₹", type: "number", required: true },
    { key: "rate_per_kg", label: "₹/kg", type: "number", required: true },
    { key: "cod_fee_pct", label: "COD fee %", type: "number", required: true, hideInTable: true },
    { key: "cod_limit", label: "COD limit ₹", type: "number", required: true, hideInTable: true },
    { key: "integration", label: "Integration", type: "select", options: opts("manual", "api", "csv", "webhook"), required: true },
    { key: "status", label: "Status", type: "select", options: opts("onboarding", "active", "suspended"), required: true },
  ];
  return (
    <AppShell title="Merchants">
      <CrudTable table="merchants" fields={fields} canEdit={role === "admin"} searchKeys={["name", "pickup_city", "contact_phone"]} empty="No merchants yet." />
    </AppShell>
  );
}
