// Mints an API token for the extension or TUI. The raw token is shown once;
// only its sha256 is stored.  usage: pnpm --filter @zenow/web token firefox
import { createHash, randomBytes } from "node:crypto";
import { apiTokens, createDb } from "@zenow/db";

const name = process.argv[2] ?? "firefox";
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const raw = randomBytes(32).toString("base64url");
const { db, sql } = createDb(url);

try {
  await db.insert(apiTokens).values({ name, tokenHash: createHash("sha256").update(raw).digest("hex") });
  console.error(`token "${name}" created; store it now, it is not recoverable:`);
  console.log(raw);
} finally {
  await sql.end();
}
