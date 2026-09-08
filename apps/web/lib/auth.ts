import { createHash } from "node:crypto";
import { apiTokens, eq } from "@zenow/db";
import { auth } from "./auth/server";
import { db } from "./db";

export type Principal =
  | { kind: "token"; name: string; tenantId: string }
  | { kind: "session"; userId: string; tenantId: string };

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/**
 * Bearer token for the extension and TUI, Neon Auth session for the browser.
 * Either way the caller comes back carrying the tenant it may act on; nothing
 * downstream is allowed to infer it.
 */
export async function authenticate(request: Request): Promise<Principal | null> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();

  if (bearer) {
    const [token] = await db()
      .select({ id: apiTokens.id, name: apiTokens.name, tenantId: apiTokens.tenantId })
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, hashToken(bearer)))
      .limit(1);
    if (!token) return null;

    await db().update(apiTokens).set({ lastUsed: new Date() }).where(eq(apiTokens.id, token.id));
    return { kind: "token", name: token.name, tenantId: token.tenantId };
  }

  const { data: session } = await auth.getSession();
  if (!session?.user) return null;

  // The user is the tenant. This used to read activeOrganizationId, which is
  // now always null -- so saves were being written against an organization id
  // while pages read them back by user id, and everything saved vanished on
  // reload.
  return { kind: "session", userId: session.user.id, tenantId: session.user.id };
}

export function unauthorized(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string): Response {
  return Response.json({ error: message }, { status: 400 });
}

export function notFound(): Response {
  return Response.json({ error: "Not found" }, { status: 404 });
}
