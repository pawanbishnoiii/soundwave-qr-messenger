import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const RANK = { admin: 4, distributor: 3, manager: 2, rider: 1 } as const;
type Role = keyof typeof RANK;

const createSchema = z.object({
  full_name: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^[6-9][0-9]{9}$/, "Enter a valid 10-digit mobile number"),
  role: z.enum(["admin", "distributor", "manager", "rider"]),
  parent_id: z.string().uuid().nullable().optional(),
});

async function roleOf(supabase: any, id: string): Promise<Role | null> {
  const { data } = await supabase.rpc("get_user_role", { _user_id: id });
  return (data ?? null) as Role | null;
}

export const createMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => createSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const myRole = await roleOf(supabase, userId);
    if (!myRole || myRole === "rider") throw new Error("You are not allowed to add team members");
    if (myRole !== "admin" && RANK[data.role] >= RANK[myRole]) throw new Error("You can only add roles below yours");

    const parentId = data.parent_id || userId;
    if (parentId !== userId) {
      if (myRole !== "admin") {
        const { data: ok } = await supabase.rpc("is_ancestor", { _anc: userId, _desc: parentId });
        if (!ok) throw new Error("Parent must be in your team");
      }
    }
    const parentRole = await roleOf(supabase, parentId);
    if (data.role !== "admin" && (!parentRole || RANK[parentRole] <= RANK[data.role])) {
      throw new Error("Parent must have a higher role than the new member");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: `p${data.phone}@phone.bnoy.app`,
      password: crypto.randomUUID() + "Aa1!",
      email_confirm: true,
      user_metadata: { full_name: data.full_name, phone: "+91" + data.phone },
    });
    if (error && /already/i.test(error.message)) throw new Error("This mobile number is already registered");
    if (error || !created.user) throw new Error(error?.message ?? "Could not create user");
    const id = created.user.id;
    await supabaseAdmin
      .from("profiles")
      .update({ parent_id: data.role === "admin" ? null : parentId, phone: "+91" + data.phone, full_name: data.full_name })
      .eq("id", id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", id);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({ user_id: id, role: data.role });
    if (rErr) throw new Error(rErr.message);
    return { id };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (data.id === userId) throw new Error("You cannot remove yourself");
    const myRole = await roleOf(supabase, userId);
    if (myRole !== "admin") {
      const { data: ok } = await supabase.rpc("is_ancestor", { _anc: userId, _desc: data.id });
      if (!ok) throw new Error("Not in your team");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Re-parent children to the removed member's parent so the tree stays intact.
    const { data: target } = await supabaseAdmin.from("profiles").select("parent_id").eq("id", data.id).maybeSingle();
    await supabaseAdmin.from("profiles").update({ parent_id: target?.parent_id ?? null }).eq("parent_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const moveMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), parent_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const myRole = await roleOf(supabase, userId);
    if (myRole !== "admin") {
      const [{ data: a }, { data: b }] = await Promise.all([
        supabase.rpc("is_ancestor", { _anc: userId, _desc: data.id }),
        supabase.rpc("is_ancestor", { _anc: userId, _desc: data.parent_id }),
      ]);
      if (!a || (!b && data.parent_id !== userId)) throw new Error("Not in your team");
    }
    const [childRole, parentRole] = await Promise.all([roleOf(supabase, data.id), roleOf(supabase, data.parent_id)]);
    if (!childRole || !parentRole || RANK[parentRole] <= RANK[childRole]) throw new Error("Parent must have a higher role");
    const { data: loop } = await supabase.rpc("is_ancestor", { _anc: data.id, _desc: data.parent_id });
    if (loop) throw new Error("Cannot move under own team member");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("profiles").update({ parent_id: data.parent_id }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
