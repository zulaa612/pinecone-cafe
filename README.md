# Pine & Pour

A responsive café ordering app built with Next.js 16, React 19, Tailwind CSS 4, SQLite (Drizzle ORM) and TypeScript.

## Setup

```sh
npm install
cp .env.example .env.local     # then edit values
npm run db:push                # create the SQLite tables
npm run db:seed                # create/update the admin account from .env.local
npm run dev
```

Open http://localhost:3000. For production run `npm run build` then `npm start` (`SESSION_SECRET` is required).

The app and database scripts create the parent directory for local SQLite files automatically. `db:push` also loads `.env.local`, so schema setup uses the same `DATABASE_URL` as the app. The tables and staff account still need the setup commands above; `.env.example` alone is not loaded by Next.js.

### Environment variables

| Name | Purpose |
|---|---|
| `DATABASE_URL` | SQLite file, default `file:./data/cafe.db` |
| `SESSION_SECRET` | Signs session cookies (required in production) |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Admin account created by `npm run db:seed` |

## Guest ordering and staff access

- Browse the menu, add products and open checkout directly. Customer registration, login and account pages have been removed, together with authentication controls in the public navigation.
- Checkout is the only place that collects customer details: **Full Name**, **Class / Grade** and **Teacher / Student** are required for each order. Prices on the menu and product detail page remain the listed prices. Selecting a role in checkout previews the final total; the server applies the existing pricing rules without showing a discount percentage or discount line.
- Order confirmation opens the tracker. A private, HTTP-only cookie identifies orders from this browser after checkout; browsing does not create an identity. Clearing that cookie or using another browser removes access to those guest orders.
- Reviews use the name collected at checkout and require an order containing the reviewed item in the same browser. A second review updates the earlier review without collecting customer details again.
- Open **Admin** from the desktop navigation, mobile menu or footer to access `/admin`. Staff accounts are created by the seed script. Only signed-in admins can add, edit, delete or change the availability of products; every product action checks the admin role on the server.

### Updating an existing database

Before starting the updated app against an existing database, run:

```sh
npm run db:migrate:guest
```

This migration preserves existing users, orders, order items and reviews while allowing nullable order/review user IDs and adding guest ownership and review-name columns. It checks row counts and foreign keys before committing and can be rerun safely. Use `npm run db:push` when initializing a new database as shown in Setup.

### Removed customer authentication files

The following redundant files have been deleted:

- `src/app/login/page.tsx`
- `src/app/register/page.tsx`
- `src/app/account/page.tsx`
- `src/app/account/actions.ts`
- `src/components/auth-form.tsx`
- `src/components/auth.css`
- `src/components/account-page.tsx`
- `src/locales/auth.ts`

`src/app/auth/actions.ts` now contains only the staff sign-out action. Keep `src/app/admin/`, `src/lib/auth/`, the users table and the seed script for staff access and existing data relationships.

## Server-side rules

- Every mutation is a server action that validates input with zod. Administrative mutations additionally re-check the staff session and role; guest actions check order ownership where required.
- Order pricing and totals are computed on the server from database prices and the role submitted at checkout (`src/lib/pricing.ts`); the client only previews the total.
- Product images can be an https URL or an upload (PNG/JPG/WebP/GIF up to 1 MB, saved to `public/uploads`).
- New orders are paid through QPay using Wire.mn hosted checkout. The server prices the order, creates a QPay-only PaymentIntent and redirects to Wire for its QR code/bank-app links. Only a verified provider status can mark an order paid; redirect query parameters never do. Staff cannot advance unpaid orders. Older orders without a payment record retain pay-at-collection behavior.

## MNT and QPay through Wire.mn

All catalog, cart, order and admin amounts are **Mongolian tugrug (MNT / ₮)**. Existing numeric catalog prices are retained, with no exchange-rate conversion. New product prices must be whole MNT. The existing `*_cents` database columns retain their scale of 100 for compatibility; Wire receives the final total in **whole MNT**, never multiplied by 100. Role pricing is applied first and the final payable total is rounded to the nearest whole tugrug (minimum ₮1 for a nonempty order).

Add these server-only values to `.env.local` and your deployment secrets:

| Name | Purpose |
|---|---|
| `WIRE_API_KEY` | Wire secret key; never use a `NEXT_PUBLIC_` variable or commit it |
| `WIRE_QPAY_OPERATOR_ID` | Active QPay operator ID from your Wire project/Connectors; the current account reports `qpay` |
| `APP_URL` | Canonical public HTTPS origin in production; must be the same origin shoppers use so guest cookies survive the return. Local development can infer a localhost origin from the checkout request |
| `WIRE_WEBHOOK_SECRET` | Optional endpoint signing secret (`whsec_...`), distinct from the API key |

For an existing database run `npm run db:migrate:payments` before starting this version. This additive, repeatable migration creates the payment ledger and webhook deduplication table without changing existing orders or prices. New databases can use `npm run db:push` as usual.

In Wire, activate QPay, enable it on the project and configure its settlement account. This implementation uses [Wire hosted checkout](https://docs.wire.mn/en/docs/guides/hosted-checkout) with `allowed_operators` restricted to the configured QPay ID. Creating an intent and session uses stable, separate idempotency keys per order attempt; retrying a canceled/expired intent creates a new attempt. A hosted checkout URL can be resumed from the order tracker after a network failure. The API key and intent client secret are never returned to the browser.

For automatic payment updates, register the public endpoint **`POST /api/payments/wire/webhook`** in Wire and save its returned signing secret as `WIRE_WEBHOOK_SECRET`. Subscribe to `payment_intent.succeeded`, `payment_intent.payment_failed` and `payment_intent.canceled`; complete Wire's signed endpoint verification. See [Wire webhooks](https://docs.wire.mn/en/docs/guides/webhooks) for the deployment IP allowlist. The handler verifies the raw-body HMAC signature and timestamp, handles verification pings, deduplicates event IDs and retrieves the intent to confirm amount/currency/status before updating the order. Without a public webhook, the browser's **Check payment** action and checkout return verify status through the server.

Run `npm run test:currency`, `npm run test:payments`, `npm run test:guest` and `npm run build` to verify the integration without creating a live invoice or moving money. Provider tests use mock responses and isolated in-memory databases.

## Data

Products, staff/legacy users, orders and reviews live in SQLite (`data/`, gitignored). The cart is saved in localStorage (`pine-and-pour-cart`); guest order ownership is stored in an HTTP-only cookie. Checkout details stay in form state until the order is submitted. Data from the earlier localStorage prototype is discarded automatically.

## Language and theme

- **English only.** All pages, server errors and validation messages use English. There is no language switcher, and existing language cookies are ignored.
- All text lives in `src/locales/` (`common`, `storefront`, `orders`, `admin`, `customer`). Each file declares English messages with `defineMessages`. Use `t("key")` from `useI18n()` in client components and `getT()` (`src/lib/i18n-server.ts`) in server code.
- Product names/descriptions and customer reviews are user content and are not translated.
- **Dark / light mode.** The toggle is in the header. The theme is stored in `localStorage` (`pine-theme`) and falls back to the system setting; a tiny inline script in `<head>` applies it before first paint so there is no flash. Every color in the CSS is a `--c-<hex>` variable defined in `src/app/theme.css` (generated), and surfaces that stay dark in both modes are listed in `src/app/theme-keep.css`.
