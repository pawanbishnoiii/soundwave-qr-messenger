import { describe, expect, it } from "vitest";
import { planStops, DEFAULT_CONSTRAINTS, type PlanParcel } from "@/lib/stop-plan";

const p = (id: string, o: Partial<PlanParcel> = {}): PlanParcel => ({
  id, tracking_code: id, pincode: "335001", city: "X", receiver_address: "a", weight_kg: 1, cod_amount: 0,
  attempt_count: 0, service_level: "standard", promised_by: null, ...o,
});

describe("planStops", () => {
  it("flags cash at or above the high-cash limit", () => {
    const { stops } = planStops([p("a", { cod_amount: 2000 }), p("b", { cod_amount: 1999 })], DEFAULT_CONSTRAINTS);
    expect(stops.find((s) => s.parcel.id === "a")!.flags).toContain("high_cash");
    expect(stops.find((s) => s.parcel.id === "b")!.flags).not.toContain("high_cash");
  });
  it("skips parcels beyond the weight limit", () => {
    const { stops, skipped } = planStops([p("a", { weight_kg: 30 }), p("b", { weight_kg: 20 })], { ...DEFAULT_CONSTRAINTS, maxWeightKg: 40 });
    expect(stops).toHaveLength(1);
    expect(skipped).toHaveLength(1);
  });
  it("puts same-day before standard", () => {
    const { stops } = planStops([p("a"), p("b", { service_level: "same_day" })], DEFAULT_CONSTRAINTS);
    expect(stops[0]!.parcel.id).toBe("b");
  });
  it("respects max stops", () => {
    const { stops } = planStops([p("a"), p("b"), p("c")], { ...DEFAULT_CONSTRAINTS, maxStops: 2 });
    expect(stops).toHaveLength(2);
  });
});
