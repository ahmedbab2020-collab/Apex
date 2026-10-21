import { z } from "zod";

export const slugSchema = z
  .string()
  .trim()
  .min(3, "Use at least 3 characters")
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and hyphens");

export const storeSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: slugSchema,
  description: z.string().trim().max(1000).optional().default(""),
  logoUrl: z.string().url().or(z.literal("")).optional().default(""),
  bannerUrl: z.string().url().or(z.literal("")).optional().default(""),
  websiteUrl: z.string().url().or(z.literal("")).optional().default(""),
  xUrl: z.string().url().or(z.literal("")).optional().default(""),
  isPublished: z.boolean().default(false)
});

export const productSchema = z.object({
  title: z.string().trim().min(2).max(160),
  slug: slugSchema,
  description: z.string().trim().min(1).max(10000),
  priceMinor: z.coerce.number().int().min(0).max(100_000_000),
  currency: z.string().regex(/^[A-Z]{3}$/).default("USD"),
  category: z.string().trim().min(1).max(64),
  productType: z.enum(["ebook", "pdf", "template", "download", "asset", "software", "course"]),
  coverUrl: z.string().url().or(z.literal("")).optional().default(""),
  status: z.enum(["draft", "published"]).default("draft")
});

export const checkoutSchema = z.object({
  productId: z.string().uuid(),
  email: z.string().email().max(254)
});

export const fileUploadSchema = z.object({
  productId: z.string().uuid(),
  fileName: z.string().min(1).max(180),
  contentType: z.string().min(1).max(120),
  size: z.number().int().positive().max(250 * 1024 * 1024)
});
