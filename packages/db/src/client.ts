import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export type Database = ReturnType<typeof createDb>["db"];
export type Sql = ReturnType<typeof createDb>["sql"];

/** Neon's url carries libpq-only params that postgres.js would forward to the server. */
function stripClientOnlyParams(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete("channel_binding");
  return parsed.toString();
}

/**
 * Pooled Neon urls go through PgBouncer in transaction mode, which cannot hold
 * prepared statements. Direct urls can, and the worker wants them for its
 * `for update skip locked` claim.
 */
export function createDb(url: string, options: { max?: number } = {}) {
  const pooled = new URL(url).hostname.includes("-pooler.");
  const sql = postgres(stripClientOnlyParams(url), {
    max: options.max ?? (pooled ? 1 : 5),
    prepare: !pooled,
    onnotice: () => {},
  });
  return { sql, db: drizzle(sql, { schema }) };
}
