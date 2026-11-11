import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function isMongoDatabase(url = process.env.DATABASE_URL ?? "") {
  return /^mongodb(?:\+srv)?:\/\//i.test(url);
}

/** Prepare local SQLite storage before libsql eagerly opens its connection. */
export function getDatabaseUrl(url = process.env.DATABASE_URL ?? "file:./data/cafe.db") {
  if (isMongoDatabase(url)) {
    throw new Error("This command requires SQLite. For MongoDB run npm run db:push to create indexes; SQLite migrations do not apply.");
  }
  // Keep relative file paths relative; new URL() would resolve them from the drive root.
  const localFile = /^file:(?:\/\/(?:localhost)?(?=\/))?([^?#]*)/i.exec(url);
  if (localFile) {
    const path = decodeURIComponent(localFile[1]);
    if (path && path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  }
  return url;
}
