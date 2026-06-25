/**
 * RenovateConnect — database schema (Drizzle / Postgres).
 *
 * Conventions (see CLAUDE.md):
 *  - Money is stored in integer CENTS. Never floats.
 *  - Ratios/percentages are stored in basis points (bps): 10000 = 1.0x = 100%.
 *  - Every TENANT-SCOPED table carries `tenant_id` and an RLS policy that isolates
 *    rows by `current_setting('app.current_tenant')`. Global/platform tables do not.
 *  - The runtime connects as a non-superuser role (RLS enforced). Admin/service paths
 *    connect as a superuser/service role that bypasses RLS. See src/db/index.ts.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/* ─────────────────────────────── Enums ─────────────────────────────── */

export const tenantStatus = pgEnum("tenant_status", ["pending", "active", "suspended"]);
export const userRole = pgEnum("user_role", [
  "customer",
  "reseller_owner",
  "reseller_staff",
  "platform_admin",
  "installer",
]);
export const configuratorType = pgEnum("configurator_type", [
  "unit",
  "area",
  "linear",
  "custom",
]);
export const serviceType = pgEnum("service_type", ["delivery", "labor", "haulaway"]);
export const pricingModel = pgEnum("pricing_model", [
  "flat",
  "per_unit",
  "per_area",
  "quote",
]);
export const orderStatus = pgEnum("order_status", [
  "quote",
  "needs_quote",
  "booked",
  "scheduled",
  "in_progress",
  "completed",
  "closed",
  "canceled",
]);
export const appointmentType = pgEnum("appointment_type", ["delivery", "install", "haulaway"]);
export const appointmentStatus = pgEnum("appointment_status", [
  "pending",
  "scheduled",
  "in_progress",
  "completed",
  "canceled",
]);

/* ───────────────────────── Shared column helpers ────────────────────── */

const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().notNull();

/**
 * Standard tenant-isolation RLS policy. Applied to every tenant-scoped table.
 * `current_setting(..., true)` => missing_ok, returns NULL when unset (no rows leak).
 * The runtime sets `app.current_tenant` per request (see withTenant() in src/db).
 */
const tenantIsolation = pgPolicy("tenant_isolation", {
  as: "permissive",
  for: "all",
  to: "public",
  using: sql`tenant_id = current_setting('app.current_tenant', true)::uuid`,
  withCheck: sql`tenant_id = current_setting('app.current_tenant', true)::uuid`,
});

/* ────────────────────────── Global / platform ───────────────────────── */

/** Tenant registry. NOT tenant-scoped — this is the lookup table for host resolution. */
export const tenants = pgTable("tenants", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(), // subdomain, e.g. "acme"
  customDomain: text("custom_domain").unique(),
  customDomainVerified: boolean("custom_domain_verified").default(false).notNull(),
  status: tenantStatus("status").default("pending").notNull(),
  displayName: text("display_name").notNull(),
  // Brand config (applied as CSS variables at the layout root)
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color").default("#0f172a").notNull(),
  secondaryColor: text("secondary_color"),
  font: text("font"),
  supportEmail: text("support_email"),
  supportPhone: text("support_phone"),
  // Payments
  stripeAccountId: text("stripe_account_id"),
  // FK to markup_policies added at app layer to avoid a circular table dependency
  defaultMarkupPolicyId: uuid("default_markup_policy_id"),
  // Per-tenant payment config (deposit %, take rate override) — nullable = use env/global
  depositPercent: integer("deposit_percent"),
  platformTakeRateBps: integer("platform_take_rate_bps"),
  // ZIP codes this reseller serves (set during onboarding).
  coverageZips: jsonb("coverage_zips").$type<string[]>().default([]).notNull(),
  createdAt,
  updatedAt,
});

/** Identity. Maps to Supabase auth user id later; standalone for local dev. */
export const profiles = pgTable("profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  fullName: text("full_name"),
  phone: text("phone"),
  createdAt,
});

/** Material categories. Drives which configurator a storefront shows. */
export const verticals = pgTable("verticals", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  configuratorType: configuratorType("configurator_type").notNull(),
  icon: text("icon"),
  createdAt,
});

/** Master catalog (platform-owned, tenant-agnostic). */
export const products = pgTable("products", {
  id: uuid("id").defaultRandom().primaryKey(),
  verticalId: uuid("vertical_id")
    .notNull()
    .references(() => verticals.id, { onDelete: "restrict" }),
  name: text("name").notNull(),
  brand: text("brand"),
  description: text("description"),
  specSheetUrl: text("spec_sheet_url"),
  defaultImageUrl: text("default_image_url"),
  createdAt,
});

export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  attributes: jsonb("attributes").$type<Record<string, string>>().default({}).notNull(),
  unitOfMeasure: text("unit_of_measure").notNull().default("each"), // each | sqft | lnft
  wholesaleCents: integer("wholesale_cents").notNull(), // platform cost (floor)
  platformListCents: integer("platform_list_cents").notNull(), // base list before markup
  weightGrams: integer("weight_grams"),
  dims: jsonb("dims").$type<Record<string, number>>(),
  createdAt,
});

/** Services attachable to a job: delivery, labor (install), haulaway (removal). */
export const services = pgTable("services", {
  id: uuid("id").defaultRandom().primaryKey(),
  verticalId: uuid("vertical_id").references(() => verticals.id, { onDelete: "cascade" }),
  type: serviceType("type").notNull(),
  pricingModel: pricingModel("pricing_model").notNull(),
  baseCents: integer("base_cents").default(0).notNull(),
  perUnitCents: integer("per_unit_cents").default(0).notNull(), // per unit or per sqft
  createdAt,
});

/** ZIP-based delivery/labor/lead-time zones. */
export const serviceZones = pgTable("service_zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  zip: text("zip").notNull().unique(), // full zip or zip3 prefix
  deliveryFeeCents: integer("delivery_fee_cents").default(0).notNull(),
  laborMultiplierBps: integer("labor_multiplier_bps").default(10000).notNull(), // 10000 = 1.0x
  leadTimeDays: integer("lead_time_days").default(7).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt,
});

/** ZIP-based tax rates (bps). */
export const taxRules = pgTable("tax_rules", {
  id: uuid("id").defaultRandom().primaryKey(),
  zip: text("zip").notNull().unique(),
  rateBps: integer("rate_bps").notNull(), // 875 = 8.75%
  createdAt,
});

/* ───────────────────────── Tenant-scoped tables ──────────────────────── */

export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    role: userRole("role").notNull(),
    createdAt,
  },
  (t) => [unique("memberships_tenant_user_role").on(t.tenantId, t.userId, t.role), tenantIsolation],
);

/** The "discount level the reseller wants to offer". */
export const markupPolicies = pgTable(
  "markup_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    defaultMarkupBps: integer("default_markup_bps").default(0).notNull(),
    perVertical: jsonb("per_vertical").$type<Record<string, number>>().default({}).notNull(),
    createdAt,
  },
  () => [tenantIsolation],
);

/** Which variants a reseller sells, and at what markup override. */
export const tenantCatalog = pgTable(
  "tenant_catalog",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").default(true).notNull(),
    markupBps: integer("markup_bps"), // null = use markup policy
    createdAt,
  },
  (t) => [unique("tenant_catalog_tenant_variant").on(t.tenantId, t.variantId), tenantIsolation],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    customerProfileId: uuid("customer_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    customerEmail: text("customer_email").notNull(),
    customerPhone: text("customer_phone"),
    status: orderStatus("status").default("quote").notNull(),
    serviceAddress: jsonb("service_address").$type<Record<string, string>>(),
    // Totals snapshot — all in cents
    subtotalCents: integer("subtotal_cents").default(0).notNull(),
    deliveryCents: integer("delivery_cents").default(0).notNull(),
    laborCents: integer("labor_cents").default(0).notNull(),
    haulawayCents: integer("haulaway_cents").default(0).notNull(),
    taxCents: integer("tax_cents").default(0).notNull(),
    totalCents: integer("total_cents").default(0).notNull(),
    depositCents: integer("deposit_cents").default(0).notNull(),
    balanceCents: integer("balance_cents").default(0).notNull(),
    depositPaid: boolean("deposit_paid").default(false).notNull(),
    balancePaid: boolean("balance_paid").default(false).notNull(),
    currency: text("currency").default("usd").notNull(),
    createdAt,
    updatedAt,
  },
  () => [tenantIsolation],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    qty: integer("qty").default(1).notNull(),
    // Snapshot of how the job was configured
    configuratorType: configuratorType("configurator_type"),
    configuratorInputs: jsonb("configurator_inputs").$type<Record<string, unknown>>(),
    unitPriceCents: integer("unit_price_cents").default(0).notNull(),
    services: jsonb("services").$type<Record<string, unknown>>(), // selected services + computed prices
    lineTotalCents: integer("line_total_cents").default(0).notNull(),
    createdAt,
  },
  () => [tenantIsolation],
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: appointmentType("type").notNull(),
    installerProfileId: uuid("installer_profile_id").references(() => profiles.id, {
      onDelete: "set null",
    }),
    windowStart: timestamp("window_start", { withTimezone: true }),
    windowEnd: timestamp("window_end", { withTimezone: true }),
    status: appointmentStatus("status").default("pending").notNull(),
    createdAt,
  },
  () => [tenantIsolation],
);
