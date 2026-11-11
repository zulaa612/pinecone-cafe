import { isMongoDatabase, getDatabaseUrl } from "../src/db/config";
import { closeMongoConnection, getMongoDatabase, mongoCollections } from "../src/db/mongodb";
import { createClient } from "@libsql/client";

try {
  if (isMongoDatabase()) {
    try {
      const database = await getMongoDatabase();
      await database.command({ ping: 1 });
      const hello = await database.command({ hello: 1 });
      const collections = mongoCollections(database);
      const counts = Object.fromEntries(await Promise.all(Object.entries(collections).map(async ([key, collection]) => [key, await collection.countDocuments()])));
      const orphanItems = await collections.orderItems.aggregate([
        { $lookup: { from: "orders", localField: "orderId", foreignField: "id", as: "parent" } },
        { $match: { parent: { $size: 0 } } }, { $count: "count" },
      ]).toArray();
      const orphanPayments = await collections.orderPayments.aggregate([
        { $lookup: { from: "orders", localField: "orderId", foreignField: "id", as: "parent" } },
        { $match: { parent: { $size: 0 } } }, { $count: "count" },
      ]).toArray();
      const transactionsSupported = !!hello.setName || hello.msg === "isdbgrid";
      const problems = { orphanItems: orphanItems[0]?.count ?? 0, orphanPayments: orphanPayments[0]?.count ?? 0 };
      console.log(JSON.stringify({ backend: "mongodb", connected: true, transactionsSupported, counts, problems }, null, 2));
      if (!transactionsSupported || Object.values(problems).some(Boolean)) process.exitCode = 1;
    } finally { await closeMongoConnection(); }
  } else {
    const client = createClient({ url: getDatabaseUrl() });
    try {
      const integrity = await client.execute("PRAGMA integrity_check");
      const foreignKeys = await client.execute("PRAGMA foreign_key_check");
      console.log(JSON.stringify({ backend: "sqlite", integrity: integrity.rows, foreignKeyProblems: foreignKeys.rows.length }, null, 2));
      if (foreignKeys.rows.length || integrity.rows[0]?.integrity_check !== "ok") process.exitCode = 1;
    } finally { client.close(); }
  }
} catch (error) {
  // Never include the connection string or driver error text in diagnostic output.
  const detail = error as { name?: string; code?: string | number; syscall?: string };
  const hint = detail.syscall === "querySrv"
    ? "The configured DNS resolver failed to resolve MongoDB SRV records. Check network/DNS settings or use the cluster's standard mongodb:// connection string."
    : detail.code === 18 ? "MongoDB rejected the database credentials. Check the Atlas database user and password."
    : undefined;
  console.error(JSON.stringify({ connected: false, error: detail.name ?? "DatabaseError", code: detail.code ?? null,
    ...(detail.syscall ? { syscall: detail.syscall } : {}), ...(hint ? { hint } : {}) }));
  process.exitCode = 1;
}
