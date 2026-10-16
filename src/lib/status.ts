import type { Database } from "@/integrations/supabase/types";

export type ShipmentStatus = Database["public"]["Enums"]["shipment_status"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type Shipment = Database["public"]["Tables"]["shipments"]["Row"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const STATUS_FLOW: ShipmentStatus[] = [
  "created",
  "assigned",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
];

export const STATUS_META: Record<ShipmentStatus, { label: string; tone: string }> = {
  created: { label: "Created", tone: "bg-muted text-muted-foreground" },
  assigned: { label: "Assigned", tone: "bg-accent text-accent-foreground" },
  picked_up: { label: "Picked up", tone: "bg-sky/20 text-foreground" },
  in_transit: { label: "In transit", tone: "bg-sky/30 text-foreground" },
  out_for_delivery: { label: "Out for delivery", tone: "bg-warning/30 text-foreground" },
  delivered: { label: "Delivered", tone: "bg-success/20 text-success" },
  failed: { label: "Failed", tone: "bg-destructive/15 text-destructive" },
  returned: { label: "Returned", tone: "bg-coral/20 text-coral" },
  cancelled: { label: "Cancelled", tone: "bg-destructive/10 text-destructive" },
};

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  distributor: "Distributor",
  manager: "Manager",
  rider: "Rider",
};

export const ROLE_RANK: Record<AppRole, number> = { admin: 4, distributor: 3, manager: 2, rider: 1 };

/** Roles a user of `role` is allowed to create under themselves / their team. */
export function creatableRoles(role: AppRole | null | undefined): AppRole[] {
  if (role === "admin") return ["distributor", "manager", "rider", "admin"];
  if (role === "distributor") return ["manager", "rider"];
  if (role === "manager") return ["rider"];
  return [];
}

export function nextStatus(s: ShipmentStatus): ShipmentStatus | null {
  const i = STATUS_FLOW.indexOf(s);
  if (i < 0 || i >= STATUS_FLOW.length - 1) return null;
  return STATUS_FLOW[i + 1] ?? null;
}

export const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);

export const fmtDate = (d: string | null) =>
  d
    ? new Intl.DateTimeFormat("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Kolkata",
      }).format(new Date(d))
    : "—";
