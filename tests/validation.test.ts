import { describe, expect, it } from "vitest";
import { productSchema, slugSchema } from "../lib/validation";

describe("input validation", () => {
  it("accepts a URL-safe slug", () => expect(slugSchema.parse("my-digital-product")).toBe("my-digital-product"));
  it("rejects unsafe slugs", () => expect(() => slugSchema.parse("My Product!")).toThrow());
  it("coerces minor-unit price and requires allowed product types", () => {
    expect(productSchema.parse({ title: "Guide", slug: "guide", description: "A useful guide", priceMinor: "1999", currency: "USD", category: "Books", productType: "pdf", status: "draft" }).priceMinor).toBe(1999);
  });
});
