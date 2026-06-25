# RenovateConnect

A multi-tenant, **white-label B2C commerce + home-services platform** for renovation
building materials. Each reseller gets a self-branded storefront ("fork") that sells
**full-service bundles** — parts + delivery + professional install + haulaway of the old
fixture — at one transparent price. Resellers set their own markup; the platform curates the
catalog and takes a margin.

Repo: `BuildConnectCommerce` · package: `renovateconnect`.

---

## Stack

- **Next.js 16** (App Router) · React 19 · TypeScript (strict)
- **Tailwind CSS v4** · shadcn-style UI
- **Postgres** + **Drizzle ORM** with **Row-Level Security** for tenant isolation
- **Stripe Connect** (destination charges) — wired behind an env flag, mock provider offline
- **Resend** (email) / **Twilio** (SMS) — behind flags, mock offline
- Dev runs on local Postgres; production targets Vercel + a managed Postgres (e.g. Supabase).

> ⚠️ This repo uses Next 16 (`proxy.ts`, not `middleware.ts`) and Tailwind v4. See
> `CLAUDE.md` for conventions and `node_modules/next/dist/docs` for framework specifics.

---

## Architecture (quick map)

- **Tenant resolution**: `src/proxy.ts` reads the host → sets tenant headers; `src/server/tenant.ts`
  resolves the tenant row. Storefront branding is applied as CSS variables per request.
- **Isolation**: every tenant-scoped table has a `tenant_isolation` RLS policy keyed on
  `current_setting('app.current_tenant')`. Runtime queries go through `withTenant()`
  (RLS enforced); platform/admin paths use `adminDb` (service role, bypasses RLS).
- **Pricing**: `src/lib/pricing` — pure, server-only, unit-tested. Prices are **always**
  computed server-side (never trusted from the client). Money is integer cents; ratios are bps.
- **Cores vs actions**: request-context-free `*-core.ts` (testable) + thin `"use server"`
  wrappers that handle cookies/host/redirect.
- **Route groups / paths**: `(storefront)` (home, `/shop`, `/product`, `/cart`, `/checkout`,
  `/orders/[id]`), `/reseller/*` (dashboard), `/admin/*` (platform), `/installer/*`.

---

## Local setup

### Prerequisites
- Node 20+ (built with 24 LTS)
- PostgreSQL 14+ running locally on `:5432`

### Steps
```bash
npm install
cp .env.example .env.local      # local defaults below already work for native PG
npm run db:setup                # creates the dev DB + RLS-enforced app role (rc_app)
npm run db:migrate              # applies Drizzle migrations (schema + RLS policies)
npm run db:seed                 # 3 demo tenants, catalog, installer, sample orders
npm run dev                     # http://localhost:3000
```

`.env.local` defaults for native local Postgres (superuser password `postgres`):
```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/renovateconnect
ADMIN_BOOTSTRAP_URL=postgres://postgres:postgres@localhost:5432/postgres
APP_DATABASE_URL=postgres://rc_app:rc_app_pw@localhost:5432/renovateconnect
NEXT_PUBLIC_ROOT_DOMAIN=localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Trying it out (local subdomains)
Chrome resolves `*.localhost` automatically — no hosts-file editing.
- Storefronts: `http://acme.localhost:3000` (red), `http://northgate.localhost:3000` (blue,
  toilets only), `http://riverside.localhost:3000` (green)
- Apex / platform: `http://localhost:3000` (landing + `/onboarding` wizard)
- **Reseller dashboard**: `http://acme.localhost:3000/reseller/login`
- **Installer**: `http://acme.localhost:3000/installer/login` (Ivan)
- **Platform admin**: `http://localhost:3000/admin/login`

Dev sign-in is passwordless (a shim; replaced by real auth before production). To mint a
session cookie for scripting/tests: `npx tsx scripts/dev-token.ts acme` (reseller),
`... acme installer`, or `... admin`.

---

## Scripts
| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next dev / production build / serve |
| `npm test` | Vitest (pricing units + DB-backed integration + RLS audit + e2e) |
| `npm run db:setup` | Create dev DB + `rc_app` role + grants |
| `npm run db:migrate` / `db:generate` | Apply / generate Drizzle migrations |
| `npm run db:seed` | Reseed demo data |
| `npm run db:studio` | Drizzle Studio (browse the DB) |

---

## Payments, email, SMS (feature flags)

All three default to **mock** so the full flow works offline:
- **Stripe**: set `STRIPE_SECRET_KEY` (+ a tenant connected via `/reseller/payouts`) →
  `selectProvider` switches to real destination charges; set `STRIPE_WEBHOOK_SECRET` to enable
  the signature-verified webhook at `/api/stripe/webhook`.
- **Email**: set `RESEND_API_KEY` + `RESEND_FROM_EMAIL`.
- **SMS**: set `TWILIO_ACCOUNT_SID` + `TWILIO_AUTH_TOKEN` + `TWILIO_FROM_NUMBER`.

See `.env.example` for the full list.

---

## Deployment runbook (production)

> Needs your accounts. Nothing below is automated by this repo.

1. **Database** — create a managed Postgres (e.g. Supabase). Run migrations against it
   (`DATABASE_URL=… npm run db:migrate`). Create a non-superuser app role (RLS-enforced) and
   point `APP_DATABASE_URL` at it; `DATABASE_URL` is the service/owner role. On Supabase the
   `authenticated` / `service_role` roles map to these.
2. **Auth** — replace the dev-auth shim (`src/server/auth.ts`, the `*/login` pages, the `TODO`s)
   with Supabase Auth (or your IdP). Map auth users → `profiles` / `memberships`.
3. **Stripe** — create a Connect platform, set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET`,
   add the webhook endpoint `https://<host>/api/stripe/webhook`. Resellers onboard via
   `/reseller/payouts`.
4. **Vercel** — import the repo, set all env vars, add a **wildcard domain**
   `*.renovateconnect.app`, and add tenant custom domains as they connect them.
5. **Email/SMS** — set Resend / Twilio keys.
6. Verify: a test purchase splits funds in the Stripe test dashboard; a status change sends a
   real email/SMS.

---

## Status

B2C milestones **M0–M8 are complete and tested**; **M9** is hardening + this runbook. The
remaining production step is the live deploy (your accounts) + swapping the dev-auth shim for
real auth. B2B (accounts, net-terms, bulk quoting) is intentionally not built yet, but the
tenant/role/catalog models are kept generic enough to add it later.
