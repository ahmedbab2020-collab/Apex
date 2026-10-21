import { describe, expect, it } from "vitest";
import { calculateFees } from "../lib/money";

describe("calculateFees", () => {
  it("uses integer minor units and half-up rounding", () => {
    expect(calculateFees(1_999, 1_000, 30)).toEqual({ grossMinor: 1_999, platformFeeMinor: 230, fixedFeeMinor: 30, processingFeeMinor: 0, creatorNetMinor: 1_769 });
  });
  it("never uses a negative creator balance", () => {
    expect(calculateFees(10, 10_000, 10, 10).creatorNetMinor).toBe(0);
  });
  it("rejects invalid financial inputs", () => {
    expect(() => calculateFees(-1, 100)).toThrow("Invalid gross amount");
    expect(() => calculateFees(100, 10_001)).toThrow("Invalid commission rate");
  });
});
