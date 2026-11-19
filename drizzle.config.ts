import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:local.db";
const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso", // le pilote libsql gère aussi les fichiers locaux
  dbCredentials: { url, authToken },
});
