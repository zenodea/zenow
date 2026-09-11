import { randomBytes } from "node:crypto";
import { and, apiTokens, desc, eq } from "@zenow/db";
import { hashToken } from "./auth";
import { db } from "./db";

/** Everything the settings page is allowed to know about a token. */
export type TokenView = {
  id: string;
  name: string;
  createdAt: Date;
  lastUsed: Date | null;
};

/**
 * Only the sha256 is stored, so the raw token exists exactly once: in the
 * return value of createToken. Nothing here can hand it back later, which is
 * why the UI has to show it at mint time or not at all.
 */
export async function listTokens(tenantId: string): Promise<TokenView[]> {
  return db()
    .select({
      id: apiTokens.id,
      name: apiTokens.name,
      createdAt: apiTokens.createdAt,
      lastUsed: apiTokens.lastUsed,
    })
    .from(apiTokens)
    .where(eq(apiTokens.tenantId, tenantId))
    .orderBy(desc(apiTokens.createdAt));
}

export async function createToken(
  tenantId: string,
  name: string,
): Promise<{ raw: string; token: TokenView }> {
  const raw = randomBytes(32).toString("base64url");

  const [row] = await db()
    .insert(apiTokens)
    .values({ tenantId, name, tokenHash: hashToken(raw) })
    .returning({
      id: apiTokens.id,
      name: apiTokens.name,
      createdAt: apiTokens.createdAt,
      lastUsed: apiTokens.lastUsed,
    });

  return { raw, token: row };
}

/**
 * Scoped to the tenant on the way in: a token id is not permission to delete
 * it, the same rule the job api follows.
 */
export async function revokeToken(tenantId: string, id: string): Promise<boolean> {
  const deleted = await db()
    .delete(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.tenantId, tenantId)))
    .returning({ id: apiTokens.id });

  return deleted.length > 0;
}
