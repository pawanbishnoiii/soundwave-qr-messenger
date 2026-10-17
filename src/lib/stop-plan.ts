/** Rule-based (no AI) stop ordering with delivery-risk flags. */
export type PlanParcel = {
  id: string; tracking_code: string; pincode: string | null; city: string; receiver_address: string;
  weight_kg: number; cod_amount: number; attempt_count: number; service_level: string; promised_by: string | null;
};
export type Constraints = { maxStops: number; maxWeightKg: number; highCod: number; startHour: number; priority: "deadline" | "cash" | "express" };
export type RiskFlag = "high_cash" | "repeat_attempt" | "late_deadline" | "far_off" | "overweight";
export type PlannedStop = { parcel: PlanParcel; order: number; flags: RiskFlag[]; score: number };

export const FLAG_LABEL: Record<RiskFlag, string> = {
  high_cash: "High cash", repeat_attempt: "Repeat attempt", late_deadline: "Deadline at risk", far_off: "Far-off area", overweight: "Over weight limit",
};
export const DEFAULT_CONSTRAINTS: Constraints = { maxStops: 30, maxWeightKg: 40, highCod: 2000, startHour: 10, priority: "deadline" };

export function planStops(parcels: PlanParcel[], c: Constraints, now = new Date()): { stops: PlannedStop[]; skipped: PlanParcel[] } {
  // most common pincode prefix = "home" area; others are far-off
  const counts = new Map<string, number>();
  for (const p of parcels) { const k = (p.pincode ?? "").slice(0, 4); counts.set(k, (counts.get(k) ?? 0) + 1); }
  const home = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
  const endOfShift = new Date(now); endOfShift.setHours(Math.min(c.startHour + 9, 23), 0, 0, 0);

  const scored = parcels.map((p) => {
    const flags: RiskFlag[] = [];
    if (Number(p.cod_amount) >= c.highCod) flags.push("high_cash");
    if (p.attempt_count >= 1) flags.push("repeat_attempt");
    if (p.promised_by && new Date(p.promised_by) <= endOfShift) flags.push("late_deadline");
    if (home && (p.pincode ?? "").slice(0, 4) !== home) flags.push("far_off");
    let score = 0;
    if (p.service_level === "same_day") score += 50; else if (p.service_level === "express") score += 25;
    if (flags.includes("late_deadline")) score += c.priority === "deadline" ? 60 : 30;
    if (flags.includes("repeat_attempt")) score += 20;
    score += Math.min(Number(p.cod_amount) / 100, 30) * (c.priority === "cash" ? 2 : 1);
    if (c.priority === "express" && p.service_level !== "standard") score += 40;
    if (flags.includes("far_off")) score -= 15;
    return { parcel: p, flags, score };
  });

  // cluster by pincode, clusters ordered by their best score, inside a cluster by score
  const groups = new Map<string, typeof scored>();
  for (const s of scored) { const k = s.parcel.pincode ?? ""; groups.set(k, [...(groups.get(k) ?? []), s]); }
  const ordered = [...groups.values()]
    .map((g) => g.sort((a, b) => b.score - a.score))
    .sort((a, b) => b[0]!.score - a[0]!.score)
    .flat();

  const stops: PlannedStop[] = []; const skipped: PlanParcel[] = []; let weight = 0;
  for (const s of ordered) {
    const w = Number(s.parcel.weight_kg);
    if (stops.length >= c.maxStops) { skipped.push(s.parcel); continue; }
    if (weight + w > c.maxWeightKg) { s.flags.push("overweight"); skipped.push(s.parcel); continue; }
    weight += w;
    stops.push({ ...s, order: stops.length + 1 });
  }
  return { stops, skipped };
}
