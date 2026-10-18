import { describe, it, expect } from "vitest";
import { extractLabelDetails, destinationMatches, reconcileManifest } from "@/lib/label-rules";
describe("non-generative label routing", () => {
  it("extracts an explicitly labelled AWB", () => expect(extractLabelDetails("AWB: BN261018ABC123\nDestination 335001").tracking).toBe("BN261018ABC123"));
  it("requires review for multiple AWBs", () => expect(extractLabelDetails("AWB: BN261018ABC123\nAWB: BN261018XYZ123").tracking).toBeUndefined());
  it("does not guess sender versus receiver pincodes", () => expect(extractLabelDetails("From 335001 To 335701").pincodes).toEqual(["335001", "335701"]));
  it("rejects wrong destination bag", () => expect(destinationMatches({ pincode: "335001" }, { city: "Gharsana", pincode: "335701" })).toBe(false));
  it("detects equal-count wrong-identity receipts", () => expect(reconcileManifest(["A", "B"], ["A", "C"])).toMatchObject({ missing: ["B"], unexpected: ["C"] }));
  it("does not inflate counts from duplicate scans", () => expect(reconcileManifest(["A"], ["A", "A"])).toMatchObject({ matched: ["A"], duplicates: 1 }));
});