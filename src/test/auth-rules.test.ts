import { describe, expect, it } from "vitest";
import { canLogin, DEMO_PARCEL_COUNT } from "@/lib/auth-rules";
describe("admin login rules", () => {
  it("OTP only rejects password login", () => expect(canLogin("otp", "password")).toBe(false));
  it("password only rejects OTP login", () => expect(canLogin("password", "otp")).toBe(false));
  it("password only still permits OTP recovery", () => expect(canLogin("password", "otp", "recovery")).toBe(true));
  it("both permits both login methods", () => expect([canLogin("both", "otp"), canLogin("both", "password")]).toEqual([true, true]));
  it("seeds more than 100 parcels", () => expect(DEMO_PARCEL_COUNT).toBe(120));
});