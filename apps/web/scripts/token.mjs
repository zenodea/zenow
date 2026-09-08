// Mints an API token for the extension or TUI, scoped to one workspace.
// The raw token is shown once; only its sha256 is stored.
//   pnpm --filter @zenow/web token <tenant-id> [name]
import { createHash, randomBytes } from "node:crypto";
import { apiTokens, createDb } from "@zenow/db";

const [tenantId, name = "firefox"] = process.argv.slice(2);
const url = process.env.DATABASE_URL;

if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
if (!/^[0-9a-f-]{36}$/i.test(tenantId ?? "")) {
  console.error("usage: pnpm --filter @zenow/web token <tenant-id> [name]");
  console.error("the tenant id is your workspace's organization id, shown on /settings");
  process.exit(1);
}

const raw = randomBytes(32).toString("base64url");
const { db, sql } = createDb(url);

try {
  await db.insert(apiTokens).values({
    tenantId,
    name,
    tokenHash: createHash("sha256").update(raw).digest("hex"),
  });
  console.error(`token "${name}" created for workspace ${tenantId}; store it now:`);
  console.log(raw);
} finally {
  await sql.end();
}
