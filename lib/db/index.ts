import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/lib/db/schema";

/**
 * Lazy PostgreSQL connection using the `postgres` driver.
 * Returns `null` when DATABASE_URL is not configured (documented local-only
 * fallback). The driver connects lazily: failures surface on first query.
 */

type Database = ReturnType<typeof drizzlePg<typeof schema>>;

let cached: { db: Database; client: postgres.Sql } | null = null;

export function getDatabaseUrl(): string | null {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : null;
}

export function getDatabase(): Database | null {
  const url = getDatabaseUrl();
  if (!url) return null;

  if (!cached) {
    const client = postgres(url, { max: 5, idle_timeout: 30 });
    cached = { client, db: drizzlePg(client, { schema }) };
  }
  return cached.db;
}

/** Cleans up on test teardown / shutdown if needed. */
export async function closeDatabase(): Promise<void> {
  if (cached) {
    await cached.client.end({ timeout: 1 });
    cached = null;
  }
}
