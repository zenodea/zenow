import { createHmac } from "node:crypto";
import { eq, tenantSettings } from "@zenow/db";
import { db } from "./db";
import { env } from "./env";

/**
 * The secret a tenant's worker checks on /kick.
 *
 * Derived rather than stored: both sides can compute it from CREDENTIALS_KEY
 * and the tenant id, so there is no third credential to keep, rotate or leak.
 * Provisioning puts it on the machine as WORKER_SECRET.
 *
 * Without it /kick is open, and an open /kick on a machine that starts on
 * request is a way to run up someone else's Fly bill.
 */
export function kickSecret(tenantId: string): string {
  const key = process.env.CREDENTIALS_KEY;
  if (!key) return "";
  return createHmac("sha256", Buffer.from(key, "base64")).update(`kick:${tenantId}`).digest("hex");
}

async function tenantWorker(tenantId: string): Promise<{ url: string; secret: string } | null> {
  const [row] = await db()
    .select({ app: tenantSettings.flyAppName, status: tenantSettings.workerStatus })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!row?.app || row.status === "none" || row.status === "stopped") return null;
  return { url: `https://${row.app}.fly.dev`, secret: kickSecret(tenantId) };
}

/**
 * Nudges the worker so a save feels instant, and -- now that a tenant's
 * machine stops itself when idle -- is also what starts it again: the request
 * goes through Fly's proxy, which boots a stopped machine to serve it.
 *
 * Awaited with a short timeout rather than left dangling, because a serverless
 * function can be frozen the moment it responds. Nothing depends on it
 * arriving: the shared worker drains every tenant's queue, so a missed kick
 * costs the time until it next polls, never the job.
 */
export async function kickWorker(tenantId?: string): Promise<void> {
  const tenant = tenantId ? await tenantWorker(tenantId).catch(() => null) : null;

  const target = tenant ?? (env.workerUrl && env.workerSecret
    ? { url: env.workerUrl, secret: env.workerSecret }
    : null);
  if (!target) return;

  try {
    await fetch(new URL("/kick", target.url), {
      method: "POST",
      headers: { "x-worker-secret": target.secret },
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // A stopped machine can take longer than this to answer. The proxy has
    // already been asked to start it by then, so giving up on the response is
    // not giving up on the wake.
  }
}
