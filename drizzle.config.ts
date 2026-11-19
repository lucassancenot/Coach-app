import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? "file:local.db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "turso", // le pilote libsql gère aussi les fichiers locaux
  dbCredentials: { url, authToken: process.env.DATABASE_AUTH_TOKEN },
});
