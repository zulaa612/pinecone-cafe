import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import test from "node:test";
import { createClient } from "@libsql/client";
import { getDatabaseUrl, isMongoDatabase } from "../src/db/config";
import { mongoDatabaseName } from "../src/db/mongodb";

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

test("MongoDB URLs select the Mongo adapter and cannot reach SQLite migration commands", () => {
  for (const url of ["mongodb://localhost/cafe", "mongodb+srv://cluster.example/cafe"]) {
    assert.equal(isMongoDatabase(url), true);
    assert.throws(() => getDatabaseUrl(url), /requires SQLite/);
  }
  for (const url of ["file:./data/cafe.db", "libsql://database.example", ""]) {
    assert.equal(isMongoDatabase(url), false);
  }
});

test("Mongo database names support SRV, multi-host replica sets and explicit overrides", () => {
  assert.equal(mongoDatabaseName("mongodb+srv://cluster.example/cafe", ""), "cafe");
  assert.equal(mongoDatabaseName("mongodb://host1:27017,host2:27018/replica?replicaSet=rs0", ""), "replica");
  assert.equal(mongoDatabaseName("mongodb+srv://cluster.example/?appName=cafe", ""), "cafe");
  assert.equal(mongoDatabaseName("mongodb://localhost/original", "override"), "override");
  assert.throws(() => mongoDatabaseName("mongodb://localhost/invalid%2Fname", ""), /valid MONGODB_DB_NAME/);
});
