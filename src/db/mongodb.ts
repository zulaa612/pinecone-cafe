import { MongoClient, type ClientSession, type Db } from "mongodb";
import type { users, products, reviews, orders, orderItems, orderPayments, wireWebhookEvents } from "./schema";
import { isMongoDatabase } from "./config";

export type MongoUser = typeof users.$inferSelect;
export type MongoProduct = typeof products.$inferSelect;
export type MongoReview = typeof reviews.$inferSelect;
export type MongoOrder = typeof orders.$inferSelect;
export type MongoOrderItem = typeof orderItems.$inferSelect;
export type MongoPayment = typeof orderPayments.$inferSelect;
export type MongoWebhookEvent = typeof wireWebhookEvents.$inferSelect;

type Connection = { url: string; promise: Promise<MongoClient> };
const globalForMongo = globalThis as typeof globalThis & { __cafeMongo?: Connection };

export function mongoDatabaseName(url: string, override = process.env.MONGODB_DB_NAME) {
  // WHATWG URL rejects valid multi-host MongoDB replica-set authorities.
  const path = /^mongodb(?:\+srv)?:\/\/[^/?]*(?:\/([^?]*))?/i.exec(url)?.[1] ?? "";
  const name = override?.trim() || decodeURIComponent(path) || "cafe";
  if (!name || /[\s/\\.\x00"$]/.test(name)) throw new Error("Set a valid MONGODB_DB_NAME or database name in DATABASE_URL.");
  return name;
}

export async function getMongoClient() {
  const url = process.env.DATABASE_URL?.trim() ?? "";
  if (!isMongoDatabase(url)) throw new Error("DATABASE_URL must be a MongoDB connection string.");
  if (globalForMongo.__cafeMongo?.url !== url) {
    const previous = globalForMongo.__cafeMongo;
    if (previous) void previous.promise.then(client => client.close()).catch(() => {});
    // Keep driver/URI timeout settings; a forced 10s deadline cut slow TLS handshakes short.
    const client = new MongoClient(url, { maxPoolSize: 10 });
    const connection: Connection = { url, promise: client.connect() };
    globalForMongo.__cafeMongo = connection;
    connection.promise.catch(() => {
      if (globalForMongo.__cafeMongo === connection) delete globalForMongo.__cafeMongo;
      void client.close();
    });
  }
  return globalForMongo.__cafeMongo!.promise;
}

export async function getMongoDatabase() {
  const client = await getMongoClient();
  return client.db(mongoDatabaseName(process.env.DATABASE_URL!));
}

export function mongoCollections(database: Db) {
  return {
    users: database.collection<MongoUser>("users"),
    products: database.collection<MongoProduct>("products"),
    reviews: database.collection<MongoReview>("reviews"),
    orders: database.collection<MongoOrder>("orders"),
    orderItems: database.collection<MongoOrderItem>("order_items"),
    orderPayments: database.collection<MongoPayment>("order_payments"),
    wireWebhookEvents: database.collection<MongoWebhookEvent>("wire_webhook_events"),
  };
}
export type MongoCollections = ReturnType<typeof mongoCollections>;
export async function getMongoCollections() { return mongoCollections(await getMongoDatabase()); }

export async function withMongoTransaction<T>(run: (collections: MongoCollections, session: ClientSession) => Promise<T>) {
  const client = await getMongoClient();
  const collections = await getMongoCollections();
  return client.withSession(session => session.withTransaction(() => run(collections, session)));
}

/** Match SQLite uniqueness while allowing multiple legacy rows with null ownership/intent. */
export async function ensureMongoIndexes() {
  const c = await getMongoCollections();
  await Promise.all([
    ...[c.users, c.products, c.reviews, c.orders, c.orderItems, c.wireWebhookEvents].map(collection =>
      collection.createIndex({ id: 1 }, { unique: true, name: "id_unique" })),
    c.users.createIndex({ email: 1 }, { unique: true, name: "users_email_idx" }),
    c.products.createIndex({ createdAt: 1 }),
    c.reviews.createIndex({ productId: 1 }),
    c.reviews.createIndex({ guestTokenHash: 1, productId: 1 }, {
      unique: true, name: "reviews_guest_product_idx", partialFilterExpression: { guestTokenHash: { $type: "string" } },
    }),
    c.orders.createIndex({ status: 1, completedAt: 1 }),
    c.orders.createIndex({ userId: 1, createdAt: -1 }),
    c.orders.createIndex({ guestTokenHash: 1, createdAt: -1 }),
    c.orderItems.createIndex({ orderId: 1 }),
    c.orderItems.createIndex({ productId: 1 }),
    c.orderPayments.createIndex({ orderId: 1 }, { unique: true, name: "order_payments_order_idx" }),
    c.orderPayments.createIndex({ providerIntentId: 1 }, {
      unique: true, name: "order_payments_intent_idx", partialFilterExpression: { providerIntentId: { $type: "string" } },
    }),
  ]);
}

export async function closeMongoConnection() {
  const connection = globalForMongo.__cafeMongo;
  delete globalForMongo.__cafeMongo;
  if (connection) await (await connection.promise).close();
}
