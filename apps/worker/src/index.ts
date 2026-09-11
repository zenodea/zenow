import { randomUUID } from "node:crypto";
import { createDb } from "@zenow/db";
import { assertConfigured, env } from "./env.js";
import { runFetchJob } from "./jobs/fetch.js";
import { runResearchJob } from "./jobs/research.js";
import { runSummarizeJob } from "./jobs/summarize.js";
import { errorMessage, log } from "./logger.js";
import { drainRemote } from "./remote.js";
import { isRetryable } from "./retry.js";
import {
  claimJob,
  completeJob,
  failJob,
  requeueStrandedItems,
  sweepStaleLocks,
  type ClaimedJob,
} from "./queue.js";
import { startServer } from "./server.js";

const workerId = `${process.env.FLY_MACHINE_ID ?? "local"}-${randomUUID().slice(0, 8)}`;

let running = true;
let wake: (() => void) | null = null;

/**
 * Stopping when there is nothing to do is the point of a per-tenant machine:
 * Fly bills for a running one and next to nothing for a stopped one, and the
 * proxy starts it again on the next request to /kick. Exiting zero is what
 * makes it stop rather than restart, so the machine's restart policy must not
 * be "always".
 *
 * Work in flight always wins -- the timer only ever sees a drain that claimed
 * nothing.
 */
function sleepNow(idleSince: number): boolean {
  return env.idleExitMs > 0 && Date.now() - idleSince >= env.idleExitMs;
}

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
    let idleSince = Date.now();

    while (running) {
      try {
        if ((await drainRemote()) > 0) idleSince = Date.now();
      } catch (error) {
        log.error("loop error", { error: errorMessage(error) });
        idleSince = Date.now();
      }

      if (sleepNow(idleSince)) {
        log.info("idle, stopping", { minutes: env.idleExitMs / 60_000 });
        break;
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
      else if (job.kind === "research") await runResearchJob(db, sql, job.tenantId, job.itemId);
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

  async function drain(): Promise<number> {
    const inFlight = new Set<Promise<void>>();
    let ran = 0;

    while (running) {
      while (running && inFlight.size < env.concurrency) {
        const job = await claimJob(sql, workerId);
        if (!job) break;
        ran += 1;

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
    return ran;
  }

  let idleSince = Date.now();

  while (running) {
    try {
      const released = await sweepStaleLocks(sql, env.staleLockMinutes);
      if (released > 0) log.warn("released stale locks", { count: released });

      const requeued = await requeueStrandedItems(sql);
      if (requeued > 0) log.warn("requeued stranded items", { count: requeued });
      if ((await drain()) > 0) idleSince = Date.now();
    } catch (error) {
      log.error("loop error", { error: errorMessage(error) });
      idleSince = Date.now();
    }

    if (sleepNow(idleSince)) {
      log.info("idle, stopping", { minutes: env.idleExitMs / 60_000 });
      break;
    }
    if (running) await sleepUntilKick(env.pollIntervalMs);
  }

  server.close();
  await sql.end();
  log.info("stopped");
}

await main();
