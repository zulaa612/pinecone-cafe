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
- No payment gateway is integrated; customers pay at collection.

## Data

Products, staff/legacy users, orders and reviews live in SQLite (`data/`, gitignored). The cart is saved in localStorage (`pine-and-pour-cart`); guest order ownership is stored in an HTTP-only cookie. Checkout details stay in form state until the order is submitted. Data from the earlier localStorage prototype is discarded automatically.

## Languages and theme

- **Mongolian / English** (default Mongolian). The switcher is in the header of every page. The choice is stored in a `lang` cookie, so the server renders the right language on first paint, and switching never touches the cart or the session.
- All text lives in `src/locales/` (`common`, `storefront`, `orders`, `admin`, `customer`). Each file declares English and Mongolian side by side with `defineMessages`; a missing Mongolian key is a TypeScript error. Use `t("key")` from `useI18n()` in client components and `getT()` (`src/lib/i18n-server.ts`) in server code. Server errors and validation messages are translated too.
- Product names/descriptions and customer reviews are user content and are not translated.
- **Dark / light mode.** The toggle is in the header. The theme is stored in `localStorage` (`pine-theme`) and falls back to the system setting; a tiny inline script in `<head>` applies it before first paint so there is no flash. Every color in the CSS is a `--c-<hex>` variable defined in `src/app/theme.css` (generated), and surfaces that stay dark in both modes are listed in `src/app/theme-keep.css`.
