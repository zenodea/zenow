// Moves everything saved before tenancy into one of your workspaces.
// Migration 0003 parked those rows on a placeholder organization so tenant_id
// could be NOT NULL from the start.
//   pnpm --filter @zenow/web adopt <tenant-id>
import { createDb } from "@zenow/db";

const LEGACY = "00000000-0000-4000-8000-000000000001";
const [tenantId] = process.argv.slice(2);
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url || !/^[0-9a-f-]{36}$/i.test(tenantId ?? "")) {
  console.error("usage: pnpm --filter @zenow/web adopt <tenant-id>");
  process.exit(1);
}

const { sql } = createDb(url);

try {
  const moved = await sql.begin(async (tx) => {
    for (const table of ["contents", "summaries", "jobs", "api_tokens"]) {
      await tx`update ${tx(table)} set tenant_id = ${tenantId} where tenant_id = ${LEGACY}`;
    }
    return tx`update items set tenant_id = ${tenantId} where tenant_id = ${LEGACY} returning id`;
  });
  console.log(`moved ${moved.length} item(s) into ${tenantId}`);
} finally {
  await sql.end();
}
