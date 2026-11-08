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

## Accounts and roles

- **Customers** register at `/register` as **Student** (standard price) or **Teacher** (automatic 50% discount).
- **Admin** signs in at `/admin`. Admin accounts can only be created by the seed script. Signed-in non-admins are redirected to `/`.

## Server-side rules

- Every mutation is a server action that re-checks the session and role and validates input with zod.
- Order prices, the teacher discount and totals are computed on the server from database prices (`src/lib/pricing.ts`); the client only previews them.
- Product images can be an https URL or an upload (PNG/JPG/WebP/GIF up to 1 MB, saved to `public/uploads`).
- No payment gateway is integrated; customers pay at collection.

## Data

Products, users, orders and reviews live in SQLite (`data/`, gitignored). The cart is the only browser-side state (`pine-and-pour-cart` in localStorage). Data from the earlier localStorage prototype is discarded automatically.
