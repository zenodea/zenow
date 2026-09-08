import { fetchContent } from "@zenow/adapters";
import {
  workerClaimResponseSchema,
  type WorkerFetchResult,
  type WorkerJob,
  type WorkerSummarizeResult,
} from "@zenow/shared";
import { env } from "./env.js";
import { errorMessage, log } from "./logger.js";
import { waitForHost } from "./ratelimit.js";
import { summarize } from "./summarize/index.js";
import { isRetryable } from "./retry.js";

async function call<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${env.apiUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.workerToken}`,
    },
    body: JSON.stringify(body ?? {}),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
  return (await response.json()) as T;
}

async function claim(): Promise<WorkerJob | null> {
  const parsed = workerClaimResponseSchema.safeParse(await call("/api/worker/claim", {}));
  if (!parsed.success) throw new Error("Claim response did not match the expected shape");
  return parsed.data.job;
}

async function runJob(job: WorkerJob): Promise<void> {
  try {
    if (job.kind === "fetch") {
      const url = new URL(job.item.url);
      await waitForHost(url.host);

      const fetched = await fetchContent(url, {
        fetch,
        log,
        ...(env.redditClientId && env.redditClientSecret
          ? { reddit: { clientId: env.redditClientId, clientSecret: env.redditClientSecret } }
          : {}),
      });

      const result: WorkerFetchResult = {
        job_id: job.job_id,
        title: fetched.title,
        text: fetched.text,
        html: fetched.html ?? null,
        images: fetched.images,
        meta: fetched.meta,
      };
      await call("/api/worker/complete", result);
      log.info("fetched", { itemId: job.item.id, host: url.host, chars: fetched.text.length });
      return;
    }

    const summary = await summarize(
      {
        sourceType: job.item.source_type,
        title: job.item.title,
        url: job.item.url,
        text: job.content.text,
        images: job.content.images,
        meta: job.content.meta,
        knownTags: job.known_tags,
      },
      { apiKey: env.openrouterApiKey, model: env.model },
    );

    const result: WorkerSummarizeResult = {
      job_id: job.job_id,
      model: summary.model,
      title: summary.title,
      summary_md: summary.summary_md,
      key_points: summary.key_points,
      image_picks: summary.image_picks,
      read_time_min: summary.read_time_min,
      tags: summary.tags,
      tokens_in: summary.tokensIn,
      tokens_out: summary.tokensOut,
    };
    await call("/api/worker/complete", result);
    log.info("summarized", { itemId: job.item.id, model: summary.model, tags: summary.tags });
  } catch (error) {
    const message = errorMessage(error);
    log.warn("job failed", { jobId: job.job_id, kind: job.kind, error: message });
    await call("/api/worker/fail", {
      job_id: job.job_id,
      message: message.slice(0, 2000),
      retryable: isRetryable(error),
    }).catch((reportError) => {
      log.error("could not report failure", { error: errorMessage(reportError) });
    });
  }
}

/** Claims up to `concurrency` jobs at a time until the queue comes back empty. */
export async function drainRemote(): Promise<void> {
  const inFlight = new Set<Promise<void>>();

  while (true) {
    while (inFlight.size < env.concurrency) {
      const job = await claim();
      if (!job) break;

      const task = runJob(job).catch((error) => {
        log.error("job handler crashed", { error: errorMessage(error) });
      });
      inFlight.add(task);
      void task.finally(() => inFlight.delete(task));
    }

    if (inFlight.size === 0) break;
    await Promise.race(inFlight);
  }

  await Promise.all(inFlight);
}
