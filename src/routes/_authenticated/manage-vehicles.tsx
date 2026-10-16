import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable, type Field } from "@/components/CrudPage";
import { useMe } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { opts, useHubOptions, useRiderOptions } from "@/lib/manage";

export const Route = createFileRoute("/_authenticated/manage-vehicles")({
  head: () => pageHead("Fleet & vehicles", "Manage vehicles, documents and assignments"),
  component: Page,
});

function Page() {
  const { role } = useMe();
  const hubs = useHubOptions();
  const riders = useRiderOptions();
  void riders; void hubs; void opts;
  const fields: Field[] = [
    { key: "reg_number", label: "Registration", required: true },
    { key: "kind", label: "Type", type: "select", options: opts("bike", "scooter", "ev_scooter", "three_wheeler", "van", "truck"), required: true },
    { key: "capacity_kg", label: "Capacity (kg)", type: "number", required: true },
    { key: "ownership", label: "Ownership", type: "select", options: opts("owned", "leased", "rider_owned"), required: true },
    { key: "hub_id", label: "Hub", type: "select", options: hubs, render: (r) => hubs.find((h) => h.value === r.hub_id)?.label ?? "—" },
    { key: "rider_id", label: "Rider", type: "select", options: riders, render: (r) => riders.find((h) => h.value === r.rider_id)?.label ?? "—" },
    { key: "status", label: "Status", type: "select", options: opts("available", "on_route", "maintenance", "retired"), required: true },
    { key: "insurance_expiry", label: "Insurance till", type: "date" },
    { key: "puc_expiry", label: "PUC till", type: "date", hideInTable: true },
    { key: "fitness_expiry", label: "Fitness till", type: "date", hideInTable: true },
    { key: "notes", label: "Notes", hideInTable: true },
  ];
  return (
    <AppShell title="Fleet & vehicles">
      <CrudTable table="vehicles" fields={fields} canEdit={role === "admin" || role === "distributor" || role === "manager"} searchKeys={["reg_number", "kind"]} empty="No vehicles yet." />
    </AppShell>
  );
}
