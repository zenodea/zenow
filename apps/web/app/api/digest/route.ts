import { isNotNull, tenantSettings } from "@zenow/db";
import { authenticate, badRequest, unauthorized } from "@/lib/auth";
import { weekOf } from "@zenow/shared";
import { buildDigest, NotEnoughForDigest } from "@/lib/digest";
import { db } from "@/lib/db";
import { LlmError } from "@/lib/llm";

export const maxDuration = 60;

/** Vercel sends this on a scheduled invocation when CRON_SECRET is set. */
function isCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Runs every day and writes last week's digest for anyone who does not have
 * one yet. Daily rather than weekly so a failed Monday is picked up on
 * Tuesday; the week's url is unique, so a second run is a no-op.
 */
async function runForEveryone(): Promise<Response> {
  const week = weekOf(new Date(), -1);

  const tenants = await db()
    .select({ tenantId: tenantSettings.tenantId })
    .from(tenantSettings)
    .where(isNotNull(tenantSettings.llmKeyEncrypted));

  const results = await Promise.allSettled(
    tenants.map(({ tenantId }) => buildDigest(tenantId, week)),
  );

  const written = results.filter((result) => result.status === "fulfilled").length;
  const skipped = results.filter(
    (result) => result.status === "rejected" && result.reason instanceof NotEnoughForDigest,
  ).length;

  return Response.json({
    week: week.key,
    tenants: tenants.length,
    written,
    skipped,
    failed: results.length - written - skipped,
  });
}

/** Vercel's scheduler issues a GET, so that is the only thing this answers. */
export async function GET(request: Request) {
  if (!isCron(request)) return unauthorized();
  return runForEveryone();
}

export async function POST(request: Request) {
  const principal = await authenticate(request);
  if (!principal) return unauthorized();

  const body = (await request.json().catch(() => null)) as { week?: unknown } | null;
  if (body?.week !== undefined && body.week !== "this" && body.week !== "last") {
    return badRequest(`week must be "this" or "last"`);
  }

  const week = weekOf(new Date(), body?.week === "last" ? -1 : 0);

  try {
    const item = await buildDigest(principal.tenantId, week);
    return Response.json({ id: item.id, week: week.key });
  } catch (error) {
    if (error instanceof NotEnoughForDigest) return badRequest(error.message);
    if (error instanceof LlmError) return badRequest(error.message);
    throw error;
  }
}
