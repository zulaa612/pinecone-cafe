# Pine & Pour

A responsive café ordering UI built with React 19, Next.js 16, and Tailwind CSS 4, with separate customer and admin sections.

## Run locally

```sh
npm install
npm run dev
```

Open http://localhost:3000. For production, run `npm run build` then `npm start`.

## Customer section — `/`

Customers can browse and search admin-created products, manage their bag, check out for café pickup, track orders, and leave reviews. The catalog starts empty; products appear after an admin adds them. No sample products, orders, or reviews are created.

## Admin section — `/admin`

The protected staff interface includes product creation, editing, image uploads, availability controls, deletion, and an order board with Pending, In Preparation, Ready, and Completed statuses. There is no public registration.

For the local demo, the access code is **pinecone**. To configure staff access, create `.env.local`:

```dotenv
ADMIN_PASSWORD=your-own-staff-password
ADMIN_SESSION_SECRET=a-long-random-secret
```

Staff sessions use signed, eight-hour, HttpOnly cookies with SameSite=Lax and Secure enabled in production. Without a stable session secret, sessions expire when the server restarts.

## Data and prototype scope

Products, orders, reviews, and the cart are saved in this browser's localStorage under `pine-and-pour-v2` and synchronized across tabs. Earlier preview sample records are removed during migration; admin-created records are preserved.

Checkout creates a local demonstration order and takes no payment. Staff authentication protects the dashboard route; browser data is not a protected, shared backend. Add server-side storage, authorization, payment processing, and rate limiting before operating a real ordering service.

Photography and fonts are bundled locally. Source information and font licenses are in `public/images/sources.json` and `public/fonts/`.

## Validation

`npm run build` includes TypeScript validation. Customer and admin interactions were also checked in headless Chrome at desktop and mobile sizes.
