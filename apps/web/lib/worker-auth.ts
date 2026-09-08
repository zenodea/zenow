import { createHash } from "node:crypto";
import { eq, tenantSettings } from "@zenow/db";
import { db } from "./db";

export function hashWorkerToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/**
 * A worker running on a tenant's own Fly account authenticates with a token
 * issued when it was provisioned. It only ever resolves to that one tenant, so
 * there is nothing it can ask for on behalf of another.
 */
export async function tenantForWorker(request: Request): Promise<string | null> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();
  if (!bearer) return null;

  const [row] = await db()
    .select({ tenantId: tenantSettings.tenantId })
    .from(tenantSettings)
    .where(eq(tenantSettings.workerTokenHash, hashWorkerToken(bearer)))
    .limit(1);

  return row?.tenantId ?? null;
}
