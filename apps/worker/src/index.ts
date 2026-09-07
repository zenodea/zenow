import { randomUUID } from "node:crypto";
import { AdapterError } from "@zenow/adapters";
import { createDb } from "@zenow/db";
import { env } from "./env.js";
import { runFetchJob } from "./jobs/fetch.js";
import { runSummarizeJob } from "./jobs/summarize.js";
import { errorMessage, log } from "./logger.js";
import { claimJob, completeJob, failJob, sweepStaleLocks, type ClaimedJob } from "./queue.js";
import { startServer } from "./server.js";
import { SummarizerError } from "./summarize/index.js";

const workerId = `${process.env.FLY_MACHINE_ID ?? "local"}-${randomUUID().slice(0, 8)}`;
const { db, sql } = createDb(env.databaseUrl, { max: env.concurrency + 1 });

let running = true;
let wake: (() => void) | null = null;

function sleepUntilKick(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      wake = null;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    wake = finish;
  });
}

/** Unknown failures are treated as transient; max_attempts stops the bleeding. */
function isRetryable(error: unknown): boolean {
  if (error instanceof AdapterError) return error.retryable;
  if (error instanceof SummarizerError) return error.retryable;
  return true;
}

async function runJob(job: ClaimedJob): Promise<void> {
  try {
    if (job.kind === "fetch") await runFetchJob(db, sql, job.itemId);
    else await runSummarizeJob(db, job.itemId);
    await completeJob(sql, job.id);
  } catch (error) {
    const message = errorMessage(error);
    const outcome = await failJob(sql, job, message, isRetryable(error));
    log.warn("job failed", {
      jobId: job.id,
      itemId: job.itemId,
      kind: job.kind,
      attempt: job.attempts,
      outcome,
      error: message,
    });
  }
}

async function drain(): Promise<void> {
  const inFlight = new Set<Promise<void>>();

  while (running) {
    while (running && inFlight.size < env.concurrency) {
      const job = await claimJob(sql, workerId);
      if (!job) break;

      const task = runJob(job).catch((error) => {
        log.error("job handler crashed", { jobId: job.id, error: errorMessage(error) });
      });
      inFlight.add(task);
      void task.finally(() => inFlight.delete(task));
    }

    if (inFlight.size === 0) break;
    await Promise.race(inFlight);
  }

  await Promise.all(inFlight);
}

async function main(): Promise<void> {
  const server = startServer(() => wake?.());
  log.info("worker started", { workerId, concurrency: env.concurrency, model: env.model });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      log.info("shutting down", { signal });
      running = false;
      wake?.();
    });
  }

  while (running) {
    try {
      const released = await sweepStaleLocks(sql, env.staleLockMinutes);
      if (released > 0) log.warn("released stale locks", { count: released });
      await drain();
    } catch (error) {
      log.error("loop error", { error: errorMessage(error) });
    }
    if (running) await sleepUntilKick(env.pollIntervalMs);
  }

  server.close();
  await sql.end();
  log.info("stopped");
}

await main();
