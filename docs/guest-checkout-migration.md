# Existing database upgrade

Stop the app and back up the SQLite database (including its journal/WAL files if present). From `cafe/`, run:

```sh
node --env-file=.env.local --import tsx scripts/migrate-guest-checkout.mts
```

The versioned migration runs in a single transaction and can safely be run again. It preserves existing users, orders, item snapshots and reviews; it does not create customer accounts. SQLite requires rebuilding the order and review tables to allow `user_id` to be null. The migration copies item rows to a new parent table before removing the old tables, checks row counts and foreign keys, and records completion in `app_migrations`.

Changes:

- `orders.user_id` and `reviews.user_id` become nullable, retaining all existing account links.
- `orders.guest_token_hash` stores a hash of an opaque browser ownership token.
- `reviews.guest_token_hash` and `reviews.customer_name` support reviews from an item's checkout identity.
- Guest reviews have a unique `(guest_token_hash, product_id)` index.
- Existing `orders.location` remains for historical orders; new checkouts require `class_grade` for either role.

New empty databases can still use `npm run db:push`. Use this migration for an existing database instead of accepting destructive schema push prompts.

Run isolated validation and migration tests without touching the app database:

```sh
node --import tsx --test scripts/test-guest-checkout.mts
```

Guest order history belongs to the checkout browser via an HTTP-only cookie. Clearing that cookie removes access to its history; admins retain access through their existing separate sign-in. Only the token hash reaches SQLite, and neither token nor hash is included in public state responses. Reviews reuse the name from a noncancelled order that contains the reviewed product.
