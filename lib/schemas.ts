import { z } from "zod";

const slug = z.string().trim().min(3).max(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens.");

export const storeSchema = z.object({
  name: z.string().trim().min(2).max(60),
  slug,
  description: z.string().trim().max(500).default(""),
});

export const productSchema = z.object({
  title: z.string().trim().min(2).max(100),
  slug,
  description: z.string().trim().min(1).max(10000),
  priceMinor: z.coerce.number().int().min(50).max(100000000),
  currency: z.string().trim().length(3).transform((s) => s.toLowerCase()).default("usd"),
  category: z.string().trim().min(2).max(40),
  productType: z.enum(["ebook", "template", "download", "asset", "software", "course"]),
});

export const checkoutSchema = z.object({ productId: z.string().uuid() });

export const uploadSchema = z.object({ productId: z.string().uuid() });
