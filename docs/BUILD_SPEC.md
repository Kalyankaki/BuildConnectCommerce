# RenovateConnect — Build Spec (docs/BUILD_SPEC.md)

This is the detailed contract behind the milestone list in `CLAUDE.md`. Treat it as ground truth.

## Baked-in decisions (override in this file before building if wrong)
- **D1** "Fork a self-branded site" = **Hosted multi-tenancy** (one codebase; tenant = reseller
  storefront; subdomain + optional custom domain; dynamic branding). A separate
  **export-to-standalone-repo** path exists for resellers who demand their own deploy.
- **D2** Stack: Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Supabase
  (Postgres/Auth/Storage/RLS) + Drizzle ORM + Stripe Connect + Vercel.
  *(As installed: Next.js 16 + Tailwind v4 — see CLAUDE.md.)*
- **D3** Reseller payouts: **Stripe Connect (Standard or Express)** — platform collects, takes
  its margin, pays reseller their cut.
- **D4** Tenant isolation: **Shared Postgres + Row-Level Security keyed on `tenant_id`**.
- **D5** Service jobs payment: **Deposit at booking + balance on completion** (configurable per tenant).
- **D6** First verticals: **Carpet→Hardwood** (sq-ft measured) and **Commode/Toilet replace**
  (unit + install + haulaway) as the two reference job flows; the rest reuse those two patterns.
- **D7** Geography / pricing: **ZIP-based** delivery zones, labor rates, and tax.

## B.1 Architecture overview
- **Rendering**: Next.js App Router. Storefront, reseller dashboard, platform admin, and
  installer view are route groups in one app: `(storefront)`, `(reseller)`, `(admin)`, `(installer)`.
- **Tenant resolution**: middleware reads the host header → resolves `tenant` by subdomain
  (`acme.renovateconnect.app`) or custom domain (`shop.acmeremodel.com`) → injects `tenant_id`
  into request context. Platform admin lives on the apex/root host.
- **Data**: Supabase Postgres with RLS. Drizzle for schema + typed queries. Supabase Auth for
  identity; a `profiles` table maps auth users → roles → tenant memberships.
- **Payments**: Stripe Connect (Standard). The platform is the Stripe platform account; each
  reseller is a connected account. Customer pays the storefront; funds split: platform margin +
  Stripe fee retained, remainder transferred to reseller.
- **Files/images**: Supabase Storage (product imagery, brand logos, room photos uploaded by
  customers for measure/quote).

> **Azure-native variant (optional):** swap Supabase→Azure Database for PostgreSQL Flexible
> Server + Entra External ID (CIAM) for auth + Azure Blob Storage for files; host on Azure
> Container Apps or Static Web Apps; keep Drizzle/Stripe/Next.js unchanged. Tenant isolation
> via Postgres RLS exactly the same way.

## B.2 Multi-tenancy & RLS
- Table `tenants`: id, slug (subdomain), custom_domain (nullable, verified flag), status, brand
  config (logo_url, primary/secondary color, font, display name, support phone/email),
  stripe_account_id, default_markup_policy_id.
- Every tenant-scoped table carries `tenant_id uuid not null references tenants(id)`.
- RLS pattern: a Postgres setting `app.current_tenant` is set per request (via a Supabase RPC or
  `set_config`), and policies read it: `USING (tenant_id = current_setting('app.current_tenant')::uuid)`.
- Platform-admin operations use the Supabase **service role** to bypass RLS deliberately, only in
  `(admin)` server actions.
- Add an automated test proving customer A on tenant 1 cannot read tenant 2's orders.

## B.3 The "fork" / storefront provisioning
"Forking a self-branded site" = **provisioning a tenant**, not copying code:
1. Reseller signs up → onboarding wizard collects: storefront name, subdomain, brand (logo
   upload, colors, font), which **verticals** to enable, **markup/discount policy**, service
   coverage ZIPs, Stripe Connect onboarding (hosted by Stripe).
2. Platform (or auto-approval) activates the tenant. A new subdomain goes live immediately,
   rendering the shared storefront theme with the tenant's brand tokens + enabled verticals +
   pricing.
3. Optional **true export**: a platform-admin action generates a standalone Next.js repo (this
   app, pre-seeded with one tenant's config, env template, and deploy button). Default flow does
   NOT do this — it's an escape hatch.

Brand tokens are applied via CSS variables set from tenant config at the layout root, so theming
is dynamic with no rebuild.

## B.4 Catalog & pricing model
**Entities** (Drizzle tables):
- `verticals` (slug, name, configurator_type: `unit` | `area` | `linear` | `custom`, icon)
- `products` (tenant-agnostic master catalog; vertical_id, name, brand, description, spec sheet
  url, default image)
- `product_variants` (product_id, sku, attributes JSON {size, color, finish}, unit_of_measure,
  **wholesale_cents**, **platform_list_cents**, weight, dims)
- `services` (type: `delivery` | `labor` | `haulaway`, vertical_id, pricing_model: `flat` |
  `per_unit` | `per_area` | `quote`, base_cents, per_unit_cents)
- `service_zones` (zip or zip3, delivery_fee_cents, labor_multiplier, lead_time_days, active)
- `tenant_catalog` (tenant_id, variant_id, enabled, **markup_bps** override) — controls which
  products a reseller sells and at what markup
- `markup_policies` (tenant_id, name, default_markup_bps, per_vertical overrides JSON) — the
  "discount level the reseller wants to offer"
- `tax_rules` (zip → rate_bps)

**Pricing engine** (`/src/lib/pricing`, server-only, pure functions, unit-tested):
```
customer_unit_price = round( platform_list_cents * (1 + markup_bps/10000) )
job_total =
    Σ(variant customer_unit_price × qty)
  + delivery_fee(zip)
  + labor_price(vertical, qty/area, zip)         // per_unit / per_area / flat / quote
  + haulaway_price(vertical, qty)
  + tax(zip, taxable_subtotal)
reseller_payout = job_total − platform_margin − stripe_fee
platform_margin = Σ((platform_list − wholesale) handling) + platform_take_rate_bps × subtotal
```
- "Discount level" the reseller offers = they lower `markup_bps` (toward 0 = sell at platform
  list; can't go below wholesale-floor enforced server-side).
- All inputs validated; price recomputed server-side at quote, at add-to-cart, and again at
  checkout (never trust client totals).

## B.5 Roles & auth
- Roles: `customer`, `reseller_owner`, `reseller_staff`, `platform_admin`, `installer`.
- `memberships` (user_id, tenant_id, role). A user can be a customer on many storefronts but
  staff on one tenant.
- Route-group guards: `(reseller)` requires reseller role on the resolved tenant; `(admin)`
  requires platform_admin (root host only); `(installer)` requires installer role.
- Customers can checkout as guest (email + phone) with optional account creation post-purchase.

## B.6 Job configurators (per vertical)
Each vertical has a guided "configure your job" flow that produces a **quote** → **bundle** →
**cart line**. Build two reference configurators first; the rest reuse the patterns:

**(a) Carpet → Hardwood (configurator_type: `area`)** — reference for measured jobs:
1. Enter room dimensions (or upload a sketch/photo for "we'll verify on site") → compute sq ft.
2. Pick hardwood product + finish (variant). Show price/sq ft (customer price from pricing engine).
3. Add **install** (labor, per_area) + **haulaway** (remove + dispose old carpet, per_area or flat).
4. Add delivery (zone). Show full bundle quote with line-item breakdown + lead time.
5. "Book this job" → cart.

**(b) Commode / Toilet replace (configurator_type: `unit`)** — reference for unit jobs:
1. Pick toilet model (variant) + qty.
2. Add **install** (labor, per_unit) + **haulaway** (old toilet removal/disposal, per_unit).
3. Delivery zone. Quote breakdown. → cart.

**Remaining verticals** map to one of the two patterns:
- Sinks, decorative panels, blinds → `unit` (with measure-assist for blinds/panels).
- Kitchen island → `unit` but flagged `quote` for labor (site visit) — show "labor: quote after measure."
- Bathroom update → a **multi-item bundle** (toilet + sink + panels) — a composite configurator
  that aggregates child unit-configurators into one job.

Configurators are config-driven (`verticals.configurator_type` + a JSON schema per vertical) so
adding a vertical is data, not new code, wherever possible.

## B.7 Cart, quote & checkout
- A **cart** holds bundle line items (each = product variant + selected services + computed quote
  snapshot + the configurator inputs).
- Re-price server-side on load and at checkout. If price drifted (catalog/zone change), surface
  the delta to the customer before payment.
- Collect service address (drives zone, tax, labor), preferred delivery + install windows.
- Checkout creates a Stripe PaymentIntent for the **deposit** (configurable %); balance
  captured/charged at completion.

## B.8 Orders, scheduling & lifecycle
- `orders` (tenant_id, customer, address, status, totals snapshot, deposit/balance state).
- `order_items` (bundle: variant, qty, services, line totals, configurator inputs).
- `appointments` (order_id, type: delivery | install | haulaway, installer_id, window, status).
- Lifecycle: `quote → booked(deposit paid) → scheduled → in_progress → completed(balance paid)
  → closed`. Plus `canceled`, `needs_quote` (for site-visit labor).
- Status timeline visible to customer, reseller, and assigned installer. Email/SMS on each transition.
- Installer capacity: simple availability per installer per ZIP per day for v1.

## B.9 Payments (Stripe Connect)
- Platform = Stripe platform account. Each reseller completes **Connect onboarding** during
  tenant provisioning (hosted by Stripe; no card/bank data touches your app).
- Customer pays on the storefront. Use **destination charges** with `application_fee_amount` =
  platform margin (+ retain Stripe fee per your policy); remainder settles to the connected
  reseller account.
- Deposit at booking, balance on completion (separate PaymentIntents or capture flow).
- Refund/cancellation policy hooks per tenant.
- **Security**: secret keys in env only; webhook signature verification required; idempotency
  keys on all charge creation.

## B.10 Reseller dashboard `(reseller)`
- Onboarding wizard (brand, verticals, markup policy, coverage ZIPs, Stripe Connect).
- Catalog manager: toggle products on/off, set per-product or per-vertical markup.
- Orders board (kanban by status), order detail, assign/track appointments.
- Branding editor (logo, colors, font, copy) → live preview of storefront.
- Payouts view (Stripe balance, transfers), basic revenue/margin reporting.
- Custom domain connect (CNAME instructions + verification).

## B.11 Platform admin `(admin)`
- Master catalog CRUD (products, variants, wholesale + list prices, spec sheets, images).
- Services & zones (delivery fees, labor models, lead times, tax rules).
- Tenant management (approve/suspend resellers, view all orders, override policies, wholesale floors).
- Installer/service-provider directory + assignment oversight.
- Platform margin / take-rate config; global reporting.
- The **export-to-standalone-repo** action (D1 escape hatch).

## B.12 Storefront UX `(storefront)`
- Branded home (tenant brand tokens), vertical landing pages, product detail with spec sheet,
  the job configurator, cart, checkout, order tracking.
- Trust elements: full-service messaging ("parts + delivery + install + haulaway, one price"),
  coverage-ZIP check up front, transparent line-item quotes.
- Mobile-first; accessible (WCAG AA on contrast, targets, keyboard).
- SEO per tenant (their brand in metadata, sitemap per storefront).

## Verticals to seed
| Vertical | Pattern | Services in bundle |
|---|---|---|
| Carpet → Hardwood | area (sq ft) | delivery + install (per_area) + haulaway (old carpet) |
| Commode / Toilet | unit | delivery + install (per_unit) + haulaway (old toilet) |
| Sink | unit | delivery + install + haulaway |
| Kitchen island | unit + labor=quote | delivery + install (site-visit quote) + haulaway |
| Bathroom update | composite | aggregated toilet + sink + panels |
| Decorative panels | unit/area | delivery + install + haulaway |
| Blinds | unit (measure-assist) | delivery + install + haulaway (old blinds) |

## Guardrails (repeat if drifting)
- Don't build B2B yet, but don't block it: keep tenant/role/catalog models generic enough to add
  B2B accounts + net-terms + bulk quoting later.
- Never compute or trust prices on the client. Never store money as floats.
- Every new tenant-scoped table needs RLS + an isolation test in the same PR.
- No secrets in code, commits, or prompts. Stripe/Supabase keys via env only.
- One milestone per PR; update CLAUDE.md when conventions change.

## Milestone acceptance checks
- **M0** migrations apply; isolation test passes; `.env.example` lists every key.
- **M1** pricing tests green; seed populates two verticals (flooring, toilets).
- **M2** two demo tenants render distinct branding on distinct subdomains; data stays isolated.
- **M3** a homeowner can configure both job types and see a correct itemized quote.
- **M4** a test purchase splits funds correctly in Stripe test dashboard; deposit recorded.
- **M5** an order moves quote→…→completed with appointments and notifications firing.
- **M6** reseller can manage catalog/markup, orders, branding, payouts, custom domain.
- **M7** platform admin CRUD for catalog/services/zones/tax/tenants/installers + export action.
- **M8** installer can see assigned jobs and capture completion to trigger balance charge.
- **M9** seed (3 tenants), RLS audit, e2e happy-path, a11y/SEO, deploy to Vercel + README runbook.
