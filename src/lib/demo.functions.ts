import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Demo team members. Each signs in with their number + demo OTP 1234. */
export const DEMO_TEAM = [
  { phone: "9000000001", name: "Demo Distributor", role: "distributor", parent: null },
  { phone: "9000000002", name: "Demo Manager", role: "manager", parent: "9000000001" },
  { phone: "9000000003", name: "Ravi Rider", role: "rider", parent: "9000000002" },
  { phone: "9000000004", name: "Sunil Rider", role: "rider", parent: "9000000002" },
  { phone: "9000000005", name: "Imran Rider", role: "rider", parent: "9000000001" },
] as const;

const STATUSES = ["created", "assigned", "picked_up", "in_transit", "out_for_delivery", "delivered", "delivered", "failed", "returned"] as const;
const NAMES = ["Aarav Sharma", "Priya Verma", "Rohit Singh", "Neha Gupta", "Vikram Rathore", "Pooja Meena", "Arjun Jat", "Kavita Kaur", "Sandeep Sethi", "Anjali Agarwal"];
const CITIES = ["Gharsana", "Anupgarh", "Suratgarh", "Raisinghnagar", "Sri Ganganagar"];
const SENDERS = ["Meesho Seller Hub", "Flipkart Marketplace", "Amazon Seller", "Shopify Store", "Local Kirana Mart"];
const pick = <T,>(a: readonly T[]) => a[Math.floor(Math.random() * a.length)];

/** Admin-only: create a demo hierarchy plus parcels spread across riders and statuses. */
export const seedDemoWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) throw new Error("Only admins can seed demo data");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const ids: Record<string, string> = {};
    let createdUsers = 0;
    for (const m of DEMO_TEAM) {
      const email = `p${m.phone}@phone.bnoy.app`;
      const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("email", email).maybeSingle();
      let id = existing?.id;
      if (!id) {
        const { data: c, error } = await supabaseAdmin.auth.admin.createUser({
          email, password: crypto.randomUUID() + "Aa1!", email_confirm: true,
          user_metadata: { full_name: m.name, phone: "+91" + m.phone },
        });
        if (error || !c.user) throw new Error(error?.message ?? "Could not create demo user");
        id = c.user.id; createdUsers++;
      }
      ids[m.phone] = id;
      await supabaseAdmin.from("profiles").update({ parent_id: (m.parent ? ids[m.parent] : userId) ?? null, phone: "+91" + m.phone, full_name: m.name }).eq("id", id);
      await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
      await supabaseAdmin.from("user_roles").insert({ user_id: id, role: m.role });
    }

    const riders = DEMO_TEAM.filter((m) => m.role === "rider").map((m) => ids[m.phone]);
    const rows = Array.from({ length: 40 }, () => {
      const status = pick(STATUSES);
      const rider = status === "created" ? null : pick(riders);
      const cod = Math.random() < 0.65 ? 100 + Math.floor(Math.random() * 30) * 50 : 0;
      return {
        sender_name: pick(SENDERS), sender_phone: "98" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0"),
        receiver_name: pick(NAMES), receiver_phone: "9" + String(Math.floor(Math.random() * 1e9)).padStart(9, "0"),
        receiver_address: `${1 + Math.floor(Math.random() * 250)}, Ward ${1 + Math.floor(Math.random() * 30)}, Main Bazaar`,
        city: pick(CITIES), pincode: "335" + String(Math.floor(Math.random() * 1000)).padStart(3, "0"),
        weight_kg: Math.round((0.2 + Math.random() * 5) * 100) / 100, cod_amount: cod,
        cod_collected: status === "delivered" && Math.random() < 0.6,
        status, rider_id: rider, created_by: userId, is_demo: true, notes: "DEMO ORDER",
      };
    });
    const { error } = await supabaseAdmin.from("shipments").insert(rows as never);
    if (error) throw new Error(error.message);
    return { users: createdUsers, shipments: rows.length };
  });
