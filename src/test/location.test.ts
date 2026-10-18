import { describe, expect, it } from "vitest";
import { validLocation } from "@/lib/location";
const now = Date.parse("2026-10-18T08:00:00Z");
const fix = { lat: 28.6139, lng: 77.209, accuracy: 15, captured_at: new Date(now).toISOString() };
describe("required scan GPS", () => {
  it("accepts fresh valid coordinates", () => expect(validLocation(fix, now)).toBe(true));
  it("rejects missing or invalid coordinates", () => expect(validLocation({ ...fix, lat: NaN }, now)).toBe(false));
  it("rejects a location older than one minute", () => expect(validLocation({ ...fix, captured_at: new Date(now - 60001).toISOString() }, now)).toBe(false));
});