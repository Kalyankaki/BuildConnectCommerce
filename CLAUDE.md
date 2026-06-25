@AGENTS.md

# RenovateConnect — Project Memory (CLAUDE.md)

## What this is
Multi-tenant, white-label **B2C** commerce + home-services platform for renovation
building materials. Tenant = a reseller's self-branded storefront. Each storefront sells
**full-service bundles**: parts + delivery + labor + haulaway. Resellers set their own
markup/discount over a wholesale price. B2C is the current priority; B2B comes later and
must not be architecturally blocked.

Repo: `BuildConnectCommerce` (GitHub: Kalyankaki/BuildConnectCommerce). Package name:
`renovateconnect`. Product name can be renamed freely.

## Stack (do not change without updating this file)
- **Next.js 16** (App Router), React 19, TypeScript (strict)
- **Tailwind CSS v4** (CSS-first config via `@theme`, not `tailwind.config.js`), shadcn/ui
- Supabase: Postgres + Auth + Storage + Row-Level Security
- Drizzle ORM (migrations in /drizzle), typed schema in /src/db
- Stripe Connect (Standard) for reseller payouts; Stripe Checkout/Payment Intents for customers
- Vercel hosting: wildcard subdomain *.renovateconnect.app + custom domains per tenant
- Resend (transactional email), Twilio optional (SMS scheduling reminders)

> ⚠️ This Next.js (16.x) and Tailwind (v4) are NEWER than common training data. Before writing
> framework code, read the relevant guide under `node_modules/next/dist/docs/` and heed
> deprecation notices (see AGENTS.md). Tailwind v4 uses `@import "tailwindcss"` + `@theme` in
> CSS — there is no `tailwind.config.js` by default.

## Non-negotiable rules
- EVERY tenant-scoped table has `tenant_id` and an RLS policy. No query crosses tenants
  except platform-admin paths that explicitly bypass via service role.
- Money is stored in integer **cents**. Never floats. One currency for v1 (USD).
- Pricing is computed server-side only. The client never sets price. See /src/lib/pricing.
- All mutations validated with Zod at the route boundary. No `any`.
- No secrets in code or prompts. Use env vars; document required keys in /.env.example.
- Server Components by default; Client Components only when interactivity requires it.

## Domain glossary
- **Platform**: the supply-chain company (super-admin). Owns catalog + wholesale prices.
- **Reseller / Tenant**: owns a storefront, sets markup, books orders.
- **Customer**: homeowner buying a full-service renovation job.
- **Service provider / Installer**: fulfills labor + haulaway; assigned to jobs.
- **Vertical**: a material category with its own job configurator (e.g. flooring, toilets).
- **Bundle**: product variant + delivery + labor + haulaway sold as one job.

## Build order (milestones)
M0 schema+RLS → M1 catalog+pricing → M2 tenant/branding ("fork") → M3 storefront+configurator
→ M4 cart/checkout/Stripe → M5 orders/scheduling → M6 reseller dashboard → M7 platform admin
→ M8 installer view → M9 hardening/seed/deploy. Build one milestone at a time; stop and let me
review before moving on.

Full contract: see `docs/BUILD_SPEC.md`.

## Conventions established (as built)
- **Tenant resolution**: `src/proxy.ts` (Next 16 renamed `middleware`→`proxy`) parses the host
  and sets `x-tenant-subdomain` / `x-tenant-custom-domain` headers — NO DB in proxy. Server code
  resolves the tenant via `getCurrentTenant()` in `src/server/tenant.ts` (reads headers, queries
  the global `tenants` registry with `adminDb`, React-`cache`d).
- **Tenant-scoped reads/writes** go through `withTenant(tenantId, tx => …)` (sets
  `app.current_tenant`; RLS enforces isolation). Cross-tenant/platform ops use `adminDb`.
- **Route groups**: `src/app/(storefront)`, `(reseller)`; admin/installer come later. The
  `(storefront)` layout applies brand tokens as CSS vars (`--brand-primary/secondary`).
- **Local dev subdomains**: `acme.localhost:3000` (Chrome resolves `*.localhost`); test via
  `curl -H "Host: acme.localhost:3000"`. Demo tenants: `acme` (all verticals), `northgate`
  (toilets only), apex = platform landing.
- `npm run db:setup && npm run db:migrate && npm run db:seed` to (re)build local data.

## Definition of done (every PR)
- Typechecks, lints, builds. RLS verified for any new tenant-scoped table.
- Pricing changes covered by a unit test in /src/lib/pricing/__tests__.
- No cross-tenant data leakage (add a test that proves isolation).
- Update this CLAUDE.md if you change the stack, schema conventions, or build order.
