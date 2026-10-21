# MONO MARKET

A production-oriented MVP for a multi-vendor digital product marketplace built with Next.js App Router, Supabase, Tailwind CSS, and Stripe Checkout. Product prices are loaded server-side, files remain private, fulfillment occurs only after a verified Stripe webhook, and Supabase Row Level Security protects creator and buyer data.

## What is included

- Email/password authentication, email confirmation, password reset, persistent sessions, and profile editing.
- One independent creator storefront per account, protected by ownership checks and unique URL slugs.
- Draft/published digital products with private uploads, secure signed downloads, course modules, lessons, and enrollment.
- Public landing page, catalog search/category filter, server-rendered store/product pages, metadata, `robots.txt`, and sitemap.
- Stripe Checkout adapter, server-created pending orders, webhook signature validation, idempotency, immutable earnings records, refund status sync, and guest access links.
- Creator sales, customers, analytics, and earnings views using real database data.
- Server-checked administrator console for users, roles, suspensions, moderation, reports, transactions, and commission settings.
- A complete initial SQL migration with foreign keys, checks, indexes, triggers, storage rules, and RLS policies.

## Project structure

```text
app/                 Next.js routes, UI, server actions, and API handlers
  api/               checkout, Stripe webhook, private uploads/downloads, refunds
  dashboard/         creator dashboard and course editor
  admin/             server-gated administration console
components/          accessible forms, cards, checkout, and empty states
lib/                 Supabase/auth, validation, money, payments, fulfillment
supabase/migrations/ database schema, RLS, and private storage policy
tests/               financial and validation unit tests
```

## Local installation

1. Use Node.js 20.9 or later.
2. Install packages:

   ```bash
   npm install
   ```

3. Create a Supabase project, then copy `.env.example` to `.env.local` and replace every placeholder. Do **not** put the service-role key in any `NEXT_PUBLIC_` variable.
4. Install the Supabase CLI and link the project:

   ```bash
   npx supabase login
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```

   Alternatively, run `supabase/migrations/202610190001_initial_marketplace.sql` in the Supabase SQL editor exactly once.
5. In Supabase Authentication, enable Email provider and add these redirect URLs:

   ```text
   http://localhost:3000/auth/callback
   http://localhost:3000/reset-password
   https://YOUR_DOMAIN/auth/callback
   https://YOUR_DOMAIN/reset-password
   ```

6. The migration creates the private `product-files` bucket. Confirm it remains private in Storage; do not add a public read policy.
7. Run the app and tests:

   ```bash
   npm run dev
   npm run typecheck
   npm test
   ```

Without Supabase or Stripe credentials, checkout returns a clear unavailable response and never simulates a paid order.

## First administrator

There is no self-service administrator signup. After creating your first account, assign the role through a trusted Supabase SQL editor session:

```sql
update public.profiles
set role = 'admin'
where id = 'THE_AUTH_USER_UUID';
```

Use this only for a trusted platform operator. The client cannot change its own role because of an RLS/trigger guard.

## Stripe setup

1. Create a Stripe account that is eligible for your business, country, digital goods, tax, and marketplace model.
2. Put the test secret key in `STRIPE_SECRET_KEY` and run the Stripe CLI locally:

   ```bash
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   ```

   Copy the printed webhook signing secret into `STRIPE_WEBHOOK_SECRET`.
3. In production register `https://YOUR_DOMAIN/api/webhooks/stripe` for `checkout.session.completed` and `charge.refunded`, then put the production signing secret in your host's encrypted environment settings.

Stripe Checkout collects a buyer payment. This app records marketplace commission and creator earnings separately. It does **not** claim to move money to sellers. Production marketplace payouts require approved Stripe Connect (or an eligible regional provider), seller onboarding/KYC, capability checks, refund/dispute handling, and a deliberately designed payout workflow before payout rows may be marked `paid`.

## Deployment

Deploy on Vercel or another Next.js-compatible host. Set all values from `.env.example` in the host's server environment, using your production app URL. Apply the migration before deploying, configure Supabase redirects and the Stripe production webhook, then run:

```bash
npm run typecheck
npm test
npm run build
```

The in-memory rate limiter is appropriate for a single application instance. Replace it with Redis/Upstash or a provider edge limiter before horizontally scaling. Review and replace the legal-page placeholders with counsel-approved Terms, Privacy, and Refund policies before accepting live payments.

## Security model

- Browser code uses only Supabase's publishable key; service-role access is server-only.
- RLS grants public reads only for published stores/products, restricts creator writes to their own store, and restricts buyer records to the authenticated buyer. Admin policies are gated by `public.is_admin()`.
- Private download authorization checks a paid order plus the logged-in buyer or high-entropy receipt token, then creates a 60-second storage URL.
- Every checkout loads price/currency from the database. A redirect never marks an order paid; only a verified, idempotent provider webhook does.
- Monetary values are integer minor units. The fee calculator has automated tests and does not use floating-point arithmetic.
