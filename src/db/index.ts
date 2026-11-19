import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

// En local : fichier SQLite. En ligne : base Turso (même pilote).
// Accepte aussi les noms posés automatiquement par l'intégration Turso de Vercel.
const client = createClient({
  url: process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN,
});

export const db = drizzle(client, { schema });
export { schema };
