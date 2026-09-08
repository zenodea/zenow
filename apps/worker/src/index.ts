import { randomUUID } from "node:crypto";
import { createDb } from "@zenow/db";
import { assertConfigured, env } from "./env.js";
import { runFetchJob } from "./jobs/fetch.js";
import { runSummarizeJob } from "./jobs/summarize.js";
import { errorMessage, log } from "./logger.js";
import { drainRemote } from "./remote.js";
import { isRetryable } from "./retry.js";
import { claimJob, completeJob, failJob, sweepStaleLocks, type ClaimedJob } from "./queue.js";
import { startServer } from "./server.js";

const workerId = `${process.env.FLY_MACHINE_ID ?? "local"}-${randomUUID().slice(0, 8)}`;

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

async function main(): Promise<void> {
  assertConfigured();

  const server = startServer(() => wake?.());
  log.info("worker started", { workerId, mode: env.mode, concurrency: env.concurrency });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      log.info("shutting down", { signal });
      running = false;
      wake?.();
    });
  }

  // A remote worker holds no database credential: it asks the api for work.
  if (env.mode === "remote") {
    while (running) {
      try {
        await drainRemote();
      } catch (error) {
        log.error("loop error", { error: errorMessage(error) });
      }
      if (running) await sleepUntilKick(env.pollIntervalMs);
    }
    server.close();
    log.info("stopped");
    return;
  }

  const { db, sql } = createDb(env.databaseUrl, { max: env.concurrency + 1 });

  async function runJob(job: ClaimedJob): Promise<void> {
    try {
      if (job.kind === "fetch") await runFetchJob(db, sql, job.tenantId, job.itemId);
      else await runSummarizeJob(db, job.tenantId, job.itemId);
      await completeJob(sql, job.id);
    } catch (error) {
      const message = errorMessage(error);
      const outcome = await failJob(sql, job, message, isRetryable(error));
      log.warn("job failed", {
        jobId: job.id,
        tenantId: job.tenantId,
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
