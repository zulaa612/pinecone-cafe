import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { getDatabaseUrl } from "../src/db/config";

test("a fresh nested SQLite database opens and retains data when reopened", async () => {
  const qaRoot = resolve(".qa");
  await mkdir(qaRoot, { recursive: true });
  const testRoot = await mkdtemp(join(qaRoot, "database-config-"));

  try {
    const databasePath = relative(process.cwd(), join(testRoot, "nested", "cafe.db"))
      .split(sep).join("/");
    const url = `file:./${databasePath}`;
    assert.equal(getDatabaseUrl(url), url);

    const first = createClient({ url });
    try {
      await first.execute("CREATE TABLE config_regression (value TEXT NOT NULL)");
      await first.execute("INSERT INTO config_regression (value) VALUES ('preserved')");
    } finally {
      first.close();
    }

    const reopened = createClient({ url: getDatabaseUrl(url) });
    try {
      const result = await reopened.execute("SELECT value FROM config_regression");
      assert.deepEqual(result.rows.map(row => row.value), ["preserved"]);
    } finally {
      reopened.close();
    }
  } finally {
    await rm(testRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});

test("in-memory database URLs remain usable", async () => {
  for (const url of [":memory:", "file::memory:", "file::memory:?cache=shared"]) {
    assert.equal(getDatabaseUrl(url), url);
    const client = createClient({ url });
    try {
      const result = await client.execute("SELECT 1 AS available");
      assert.equal(result.rows[0].available, 1);
    } finally {
      client.close();
    }
  }
});

test("remote database URLs are returned unchanged", () => {
  for (const url of ["libsql://database.example", "https://database.example"]) {
    assert.equal(getDatabaseUrl(url), url);
  }
});
