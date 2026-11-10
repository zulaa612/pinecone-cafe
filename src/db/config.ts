import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/** Prepare local SQLite storage before libsql eagerly opens its connection. */
export function getDatabaseUrl(url = process.env.DATABASE_URL ?? "file:./data/cafe.db") {
  // Keep relative file paths relative; new URL() would resolve them from the drive root.
  const localFile = /^file:(?:\/\/(?:localhost)?(?=\/))?([^?#]*)/i.exec(url);
  if (localFile) {
    const path = decodeURIComponent(localFile[1]);
    if (path && path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  }
  return url;
}
