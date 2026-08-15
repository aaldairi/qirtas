# قِرطاس · Qirtas

A QR code for every product on the shelf. Customers scan with a phone camera,
buy, and transfer the money straight to the shop. The owner confirms each
payment from their dashboard.

Multi-tenant: any shop signs up, claims a store link, and gets its own
catalogue, orders and printable QR labels. Fully bilingual (Arabic default,
English toggle) with real RTL.

Built with Next.js 16 (App Router) + Supabase (Postgres, Auth, Storage).

---

## What's here

| Surface | Route | What it does |
| --- | --- | --- |
| Marketing site | `/` | Hero, how-it-works, a real scannable QR, features, pricing |
| Sign in | `/login` | Email magic link — no passwords |
| Shop setup | `/onboarding` | Name, store link, payment methods |
| Dashboard | `/dashboard` | Today's sales, orders needing attention, most-scanned |
| Products | `/dashboard/products` | Create/edit, variants, stock, SKU, photos, per-product QR |
| Orders | `/dashboard/orders` | Filter, review the transfer receipt, confirm or reject |
| Label sheet | `/dashboard/labels` | A4 four-up shelf stickers, print-ready |
| Settings | `/dashboard/settings` | Payment methods, pickup/delivery, WhatsApp |
| Storefront | `/s/<slug>` | The shop's public catalogue |
| **Product page** | `/s/<slug>/p/<id>` | **The QR destination** — variants, quantity, buy |
| Cart / checkout | `/s/<slug>/cart`, `/checkout` | Details → transfer info → receipt upload |
| Order tracking | `/order/<token>` | Customer's live status; the link is their receipt |

There is no seeded, demo, or sample data anywhere. A new shop starts empty and
fills up from real use.

---

## Setup

### 1. Create a Supabase project

<https://supabase.com/dashboard> → **New project**. Pick a region close to your
customers (`eu-central-1` or `ap-south-1` are the nearest to Bahrain). Save the
database password somewhere safe — you won't need it for this app, but Supabase
will ask for it later.

### 2. Apply the schema

Open **SQL Editor** → **New query**, paste the entire contents of
[`supabase/schema.sql`](supabase/schema.sql), and run it. It creates every
table, the order-number allocator, row-level security policies, and both
storage buckets. It's safe to re-run.

### 3. Fill in the environment

```bash
cp .env.example .env.local
```

From **Project Settings → Data API** take the project URL, and from
**Project Settings → API Keys** take the `anon` and `service_role` keys:

```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
SUPABASE_SERVICE_ROLE_KEY=<service_role key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses row-level security. It is only ever read
on the server — never prefix it with `NEXT_PUBLIC_`, and never commit it.

### 4. Point auth at your app

**Authentication → URL Configuration**:

- **Site URL** — `http://localhost:3000` while developing, your real domain in production
- **Redirect URLs** — add `http://localhost:3000/auth/callback` and `https://<your-domain>/auth/callback`

Magic links won't sign anyone in until the callback URL is on that list.

### 5. Check it

```bash
npm run verify
```

Every line should be a `✓`. Then:

```bash
npm run dev
```

---

### Or run Supabase locally

If you have Docker running, you can develop against a local stack instead of a
hosted project — no account needed:

```bash
npx supabase start
```

It prints an API URL and keys; put those in `.env.local`. Then apply the schema
and check it:

```bash
npm run db:apply && npm run verify
```

`supabase/config.toml` already allow-lists `http://localhost:3000/auth/callback`,
so magic links work. Sign-in emails are captured at <http://127.0.0.1:54324>
instead of being sent. Stop it with `npx supabase stop`.

> `npx supabase start` also resets the database, so re-run `npm run db:apply`
> after each start.

## Going live on Vercel

1. Push this repo to GitHub.
2. <https://vercel.com/new> → import the repo. Framework detection handles the rest.
3. Add the three **Supabase** variables from `.env.local`. Leave
   `NEXT_PUBLIC_SITE_URL` **unset** unless you already have a custom domain —
   see below.
4. Deploy, then go back to Supabase → **Authentication → URL Configuration** and
   add the production **Site URL** and `https://<domain>/auth/callback`.

### The QR origin

Every printed QR code is built from `siteUrl()`, which resolves in this order:

1. `NEXT_PUBLIC_SITE_URL`, if set
2. `VERCEL_PROJECT_PRODUCTION_URL` — the project's **stable** production
   domain (`your-project.vercel.app`), not the per-deployment preview host
3. `http://localhost:3000`

**No custom domain yet?** Leave `NEXT_PUBLIC_SITE_URL` unset on Vercel. Codes
are then built against your stable `*.vercel.app` domain, which does not change
between deployments, so printed labels keep working.

**When you do attach a custom domain**, set `NEXT_PUBLIC_SITE_URL` to it. Labels
printed *before* that still resolve: Vercel keeps the `*.vercel.app` domain
assigned to the project, so old codes continue to work while new ones use the
custom domain. You don't have to reprint — though you may want to eventually,
so every shelf shows the same branded URL.

A localhost value is ignored on Vercel, so a `.env.example` copied by mistake
can't silently produce unscannable labels.

Supabase's built-in email sender is rate-limited and fine for testing. Before
real traffic, set up a custom SMTP provider under **Authentication → Emails**
so sign-in links land reliably.

---

## How money and stock work

- **BHD, three decimals.** Prices are `numeric(12,3)` in Postgres and always
  rendered with exactly three decimals, in Western digits, LTR — even in Arabic.
- **No payment gateway.** Customers pay by bank transfer, wallet, or cash, and
  upload a screenshot of the transfer. The shop reviews it and confirms. Money
  never passes through this system, so there's nothing to take a cut of.
- **Prices are never trusted from the client.** The cart cookie holds only
  product ids and quantities; names, prices and stock are re-read from the
  shop's own rows on every request.
- **Stock is held at order time** via an atomic `adjust_stock()` update, so the
  count can't drift and never goes negative. Rejecting an order puts it back.
  Two checkouts landing in the same instant can still both succeed on a last
  item — the owner sees both and rejects one. That's deliberate: nothing ships
  without their confirmation anyway.
- **Order numbers** are allocated by `next_order_code()`, a single atomic
  `UPDATE ... RETURNING` per shop — no gaps, no collisions under concurrency.
- **Receipts** live in a private bucket. The owner sees them through a
  10-minute signed URL; they are never on a public path.
- **Scan counts are real.** Each product page view records one `scan_event` per
  visitor per product per day, deduplicated by a unique index. Nothing is
  seeded or estimated.

## Security notes

- Row-level security is on for every table. The `anon` key can read shops,
  active products and variants — nothing else. Orders, which carry customer
  names and phone numbers, are unreadable with it.
- All writes go through Server Actions that resolve the signed-in user to their
  shop via `requireShop()` and scope every query by `shop_id`.
- Customers reach their order through an unguessable `public_token` and the
  page is marked `noindex`.

**Worth knowing:** receipt upload is necessarily open to anonymous customers —
that's the checkout flow. It's constrained to 5 MB and image/PDF types against
an existing shop, but it isn't rate-limited. If you ever see abuse, put a rate
limit in front of the `uploadReceipt` action.

## Commands

```bash
npm run dev        # http://localhost:3000
npm run build      # production build
npm run verify     # check env, schema, buckets
npm run typecheck  # tsc --noEmit
```

## Layout

```
src/
  app/
    actions/       server actions: shop, products, orders, cart, checkout
    dashboard/     owner-facing app
    s/[slug]/      public storefront (the QR destination)
    order/[token]/ customer order tracking
  components/      Icon, LangToggle, PaymentMethods, ProductImage, PageHeader
  lib/
    cart.ts        cookie cart + server-side repricing
    data.ts        queries + requireShop() ownership guard
    i18n.ts        the whole AR/EN dictionary
    money.ts       BHD (3dp) formatting and parsing
    qr.ts          QR generation
    supabase/      browser / server / service-role clients
  proxy.ts         session refresh + anonymous visitor id
supabase/schema.sql
```
