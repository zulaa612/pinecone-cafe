import { defineConfig } from "drizzle-kit";
import { getDatabaseUrl } from "./src/db/config";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: { url: getDatabaseUrl() },
});
