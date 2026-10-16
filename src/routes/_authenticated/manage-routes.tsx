import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable, type Field } from "@/components/CrudPage";
import { useMe } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { opts, useHubOptions, useRiderOptions } from "@/lib/manage";

export const Route = createFileRoute("/_authenticated/manage-routes")({
  head: () => pageHead("Delivery routes", "Plan daily delivery routes with rider and vehicle"),
  component: Page,
});

function Page() {
  const { role } = useMe();
  const hubs = useHubOptions();
  const riders = useRiderOptions();
  void riders; void hubs; void opts;
  const fields: Field[] = [
    { key: "route_date", label: "Date", type: "date", required: true, render: (r) => `${String(r["code"])} · ${String(r["route_date"])}` },
    { key: "hub_id", label: "Hub", type: "select", options: hubs, render: (r) => hubs.find((h) => h.value === r["hub_id"])?.label ?? "—" },
    { key: "rider_id", label: "Rider", type: "select", options: riders, render: (r) => riders.find((h) => h.value === r["rider_id"])?.label ?? "—" },
    { key: "status", label: "Status", type: "select", options: opts("planned", "active", "completed", "cancelled"), required: true },
  ];
  return (
    <AppShell title="Delivery routes">
      <CrudTable table="delivery_routes" fields={fields} canEdit={role !== "rider"} searchKeys={["code", "status"]} order="route_date" empty="No routes planned yet." />
    </AppShell>
  );
}
