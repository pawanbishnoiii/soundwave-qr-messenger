import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { CrudTable, type Field } from "@/components/CrudPage";
import { useMe } from "@/lib/auth";
import { pageHead } from "@/lib/seo";
import { opts, useHubOptions, useRiderOptions } from "@/lib/manage";

export const Route = createFileRoute("/_authenticated/manage-hubs")({
  head: () => pageHead("Hubs & branches", "Create and manage hubs, branches and sort centres"),
  component: Page,
});

function Page() {
  const { role } = useMe();
  const hubs = useHubOptions();
  const riders = useRiderOptions();
  void riders; void hubs; void opts;
  const fields: Field[] = [
    { key: "code", label: "Code", required: true },
    { key: "name", label: "Name", required: true },
    { key: "kind", label: "Type", type: "select", options: opts("hub", "branch", "sort_center", "dark_store"), required: true },
    { key: "city", label: "City", required: true },
    { key: "address", label: "Address", required: true, hideInTable: true },
    { key: "pincode", label: "Pincode" },
    { key: "capacity_per_day", label: "Capacity/day", type: "number", required: true },
    { key: "opens_at", label: "Opens", type: "time", hideInTable: true },
    { key: "closes_at", label: "Closes", type: "time", hideInTable: true },
    { key: "contact_phone", label: "Phone", hideInTable: true },
    { key: "serviceable_pincodes", label: "Serviceable pincodes", type: "tags", hideInTable: true, placeholder: "335001, 335002" },
    { key: "status", label: "Status", type: "select", options: opts("active", "paused", "closed"), required: true },
  ];
  return (
    <AppShell title="Hubs & branches">
      <CrudTable table="hubs" fields={fields} canEdit={role === "admin"} searchKeys={["code", "name", "city"]} empty="No hubs yet." />
    </AppShell>
  );
}
