import { env } from "./env";

/**
 * Nudges the worker so a save feels instant. Awaited with a short timeout
 * rather than left dangling, because a serverless function can be frozen the
 * moment it responds. The worker polls anyway, so a failed kick only costs
 * latency, never the job.
 */
export async function kickWorker(): Promise<void> {
  const { workerUrl, workerSecret } = env;
  if (!workerUrl || !workerSecret) return;

  try {
    await fetch(new URL("/kick", workerUrl), {
      method: "POST",
      headers: { "x-worker-secret": workerSecret },
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Polling picks it up within 30s.
  }
}
