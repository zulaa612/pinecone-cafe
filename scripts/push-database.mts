import { spawnSync } from "node:child_process";
import { isMongoDatabase } from "../src/db/config";
import { closeMongoConnection, ensureMongoIndexes } from "../src/db/mongodb";

if (isMongoDatabase()) {
  try {
    await ensureMongoIndexes();
    console.log("MongoDB collections and indexes are ready.");
  } finally { await closeMongoConnection(); }
} else {
  const result = spawnSync(process.execPath, ["node_modules/drizzle-kit/bin.cjs", "push"], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
