import { relations, sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const ROLES = ["admin", "customer"] as const;
export const CUSTOMER_TYPES = ["student", "teacher"] as const;
export const CATEGORIES = ["Coffee", "Non-Coffee", "Meal"] as const;
export const ORDER_STATUSES = ["pending", "preparing", "ready", "completed", "cancelled"] as const;

export type Role = (typeof ROLES)[number];
export type CustomerType = (typeof CUSTOMER_TYPES)[number];
export type Category = (typeof CATEGORIES)[number];
export type OrderStatus = (typeof ORDER_STATUSES)[number];

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = () => text("created_at").notNull().default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`);

/** All money values are integer cents to avoid floating-point drift. */
export const users = sqliteTable("users", {
  id: id(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ROLES }).notNull().default("customer"),
  customerType: text("customer_type", { enum: CUSTOMER_TYPES }).notNull().default("student"),
  /** Id of the last quote shown on login, used to avoid consecutive repeats. */
  lastQuoteId: text("last_quote_id"),
  createdAt: createdAt(),
}, t => [uniqueIndex("users_email_idx").on(t.email)]);

export const products = sqliteTable("products", {
  id: id(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  priceCents: integer("price_cents").notNull(),
  category: text("category", { enum: CATEGORIES }).notNull(),
  image: text("image").notNull().default(""),
  available: integer("available", { mode: "boolean" }).notNull().default(true),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  createdAt: createdAt(),
});

export const reviews = sqliteTable("reviews", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  /** Retained for existing account reviews; guest reviews use the checkout browser key. */
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  guestTokenHash: text("guest_token_hash"),
  customerName: text("customer_name"),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull().default(""),
  createdAt: createdAt(),
}, t => [index("reviews_product_idx").on(t.productId), uniqueIndex("reviews_guest_product_idx").on(t.guestTokenHash, t.productId)]);

export const orders = sqliteTable("orders", {
  id: text("id").primaryKey(),
  /** Nullable for guest orders; existing account associations remain intact. */
  userId: text("user_id").references(() => users.id),
  /** Only a SHA-256 hash is stored, never the browser's opaque ownership token. */
  guestTokenHash: text("guest_token_hash"),
  customerName: text("customer_name").notNull(),
  /** Snapshot of the customer's type at order time; drives pricing. */
  customerType: text("customer_type", { enum: CUSTOMER_TYPES }).notNull(),
  /** Class/grade collected from both students and teachers at checkout. */
  classGrade: text("class_grade"),
  /** Legacy delivery detail retained for historical orders. */
  location: text("location"),
  status: text("status", { enum: ORDER_STATUSES }).notNull().default("pending"),
  subtotalCents: integer("subtotal_cents").notNull(),
  discountCents: integer("discount_cents").notNull().default(0),
  totalCents: integer("total_cents").notNull(),
  createdAt: createdAt(),
  completedAt: text("completed_at"),
}, t => [index("orders_status_completed_idx").on(t.status, t.completedAt), index("orders_user_idx").on(t.userId), index("orders_guest_idx").on(t.guestTokenHash)]);

export const orderItems = sqliteTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  /** Nullable so deleting a product never erases order history. */
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  unitPriceCents: integer("unit_price_cents").notNull(),
  quantity: integer("quantity").notNull(),
}, t => [index("order_items_order_idx").on(t.orderId), index("order_items_product_idx").on(t.productId)]);

export const productsRelations = relations(products, ({ many }) => ({ reviews: many(reviews) }));
export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  user: one(users, { fields: [reviews.userId], references: [users.id] }),
}));
export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
}));
export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));
