import { createHash } from "node:crypto";
import { apiTokens, eq } from "@zenow/db";
import { db } from "./db";
import { getSession } from "./session";

export type Principal = { kind: "token"; name: string } | { kind: "session" };

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw.trim()).digest("hex");
}

/** Bearer token for the extension and TUI, signed cookie for the browser. */
export async function authenticate(request: Request): Promise<Principal | null> {
  const bearer = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1]?.trim();

  if (bearer) {
    const [token] = await db()
      .select({ id: apiTokens.id, name: apiTokens.name })
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, hashToken(bearer)))
      .limit(1);
    if (!token) return null;

    await db().update(apiTokens).set({ lastUsed: new Date() }).where(eq(apiTokens.id, token.id));
    return { kind: "token", name: token.name };
  }

  return (await getSession()).loggedIn ? { kind: "session" } : null;
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
