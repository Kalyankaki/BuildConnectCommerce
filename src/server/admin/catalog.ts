"use server";
/**
 * Minimal platform-admin catalog actions (M1).
 *
 * These run with the admin (RLS-bypass) connection because the master catalog is
 * platform-owned and tenant-agnostic. Real authorization (platform_admin role + root
 * host) is wired in M7; for now these are server-only functions with Zod validation at
 * the boundary (CLAUDE.md non-negotiables). No UI yet.
 *
 * Money is always integer cents; never floats.
 */
import { z } from "zod";
import { adminDb } from "@/db";
import {
  productVariants,
  products,
  verticals,
} from "@/db/schema";
import { eq } from "drizzle-orm";

const cents = z.number().int().nonnegative();

/* ───────────────────────────── verticals ────────────────────────────── */

const createVerticalSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, "lowercase, digits, hyphens only"),
  name: z.string().min(1),
  configuratorType: z.enum(["unit", "area", "linear", "custom"]),
  icon: z.string().optional(),
});

export async function createVertical(input: z.infer<typeof createVerticalSchema>) {
  const data = createVerticalSchema.parse(input);
  const [row] = await adminDb.insert(verticals).values(data).returning();
  return row;
}

export async function listVerticals() {
  return adminDb.select().from(verticals);
}

/* ───────────────────────────── products ─────────────────────────────── */

const createProductSchema = z.object({
  verticalId: z.string().uuid(),
  name: z.string().min(1),
  brand: z.string().optional(),
  description: z.string().optional(),
  specSheetUrl: z.string().url().optional(),
  defaultImageUrl: z.string().url().optional(),
});

export async function createProduct(input: z.infer<typeof createProductSchema>) {
  const data = createProductSchema.parse(input);
  const [row] = await adminDb.insert(products).values(data).returning();
  return row;
}

export async function listProducts() {
  return adminDb.select().from(products);
}

/* ─────────────────────────── product variants ───────────────────────── */

const createVariantSchema = z.object({
  productId: z.string().uuid(),
  sku: z.string().min(1),
  attributes: z.record(z.string(), z.string()).default({}),
  unitOfMeasure: z.string().min(1).default("each"),
  wholesaleCents: cents,
  platformListCents: cents,
  weightGrams: z.number().int().nonnegative().optional(),
});

export async function createVariant(input: z.infer<typeof createVariantSchema>) {
  const data = createVariantSchema.parse(input);
  if (data.platformListCents < data.wholesaleCents) {
    throw new Error("platformListCents must be >= wholesaleCents (no list below cost)");
  }
  const [row] = await adminDb.insert(productVariants).values(data).returning();
  return row;
}

const updateVariantPricingSchema = z.object({
  id: z.string().uuid(),
  wholesaleCents: cents,
  platformListCents: cents,
});

export async function updateVariantPricing(input: z.infer<typeof updateVariantPricingSchema>) {
  const { id, wholesaleCents, platformListCents } = updateVariantPricingSchema.parse(input);
  if (platformListCents < wholesaleCents) {
    throw new Error("platformListCents must be >= wholesaleCents (no list below cost)");
  }
  const [row] = await adminDb
    .update(productVariants)
    .set({ wholesaleCents, platformListCents })
    .where(eq(productVariants.id, id))
    .returning();
  return row;
}

export async function deleteVariant(input: { id: string }) {
  const id = z.string().uuid().parse(input.id);
  await adminDb.delete(productVariants).where(eq(productVariants.id, id));
}

export async function listVariants() {
  return adminDb.select().from(productVariants);
}
