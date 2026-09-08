import {
  and,
  contents,
  desc,
  eq,
  items,
  jobs,
  sql,
  summaries,
  tenantSettings,
  type Database,
} from "@zenow/db";
import { normalizeTags, type WorkerFailure, type WorkerFetchResult, type WorkerJob, type WorkerSummarizeResult } from "@zenow/shared";
import { db } from "./db";

const VOCABULARY_SIZE = 40;
const STALE_LOCK_MINUTES = 10;

function itemView(item: typeof items.$inferSelect) {
  return { id: item.id, url: item.url, title: item.title, source_type: item.sourceType };
}

/**
 * Same SKIP LOCKED claim the in-process worker uses, restricted to one tenant
 * and reachable over http, so a worker on someone else's infrastructure never
 * needs a database credential.
 */
export async function claimForTenant(tenantId: string): Promise<WorkerJob | null> {
  const database: Database = db();

  await database.execute(sql`
    update jobs set locked_at = null, locked_by = null
     where tenant_id = ${tenantId}
       and locked_at < now() - make_interval(mins => ${STALE_LOCK_MINUTES})
  `);

  const claimed = await database.execute<{
    id: string;
    item_id: string;
    kind: "fetch" | "summarize";
  }>(sql`
    update jobs
       set locked_at = now(), locked_by = 'remote', attempts = attempts + 1
     where id = (
       select id from jobs
        where tenant_id = ${tenantId}
          and locked_at is null
          and run_after <= now()
        order by created_at
        limit 1
        for update skip locked
     )
    returning id, item_id, kind
  `);

  const row = claimed[0];
  if (!row) return null;

  const jobId = Number(row.id);
  const [item] = await database
    .select()
    .from(items)
    .where(and(eq(items.tenantId, tenantId), eq(items.id, row.item_id)))
    .limit(1);

  if (!item) {
    await database.delete(jobs).where(eq(jobs.id, jobId));
    return null;
  }

  if (row.kind === "fetch") {
    await database
      .update(items)
      .set({ status: "fetching", updatedAt: new Date() })
      .where(eq(items.id, item.id));
    return { kind: "fetch", job_id: jobId, item: itemView(item) };
  }

  const [content] = await database.select().from(contents).where(eq(contents.itemId, item.id)).limit(1);
  if (!content) {
    await database.delete(jobs).where(eq(jobs.id, jobId));
    return null;
  }

  const knownTags = await database
    .select({ tag: sql<string>`tag`, uses: sql<number>`count(*)::int` })
    .from(sql`items, unnest(items.tags) as tag`)
    .where(eq(items.tenantId, tenantId))
    .groupBy(sql`tag`)
    .orderBy(desc(sql`count(*)`), sql`tag`)
    .limit(VOCABULARY_SIZE);

  await database
    .update(items)
    .set({ status: "summarizing", updatedAt: new Date() })
    .where(eq(items.id, item.id));

  return {
    kind: "summarize",
    job_id: jobId,
    item: itemView(item),
    content: { text: content.text, images: content.images, meta: content.meta },
    known_tags: knownTags,
  };
}

/** Guards every write: a job id alone is not permission to touch it. */
async function ownedJob(tenantId: string, jobId: number) {
  const [job] = await db()
    .select()
    .from(jobs)
    .where(and(eq(jobs.tenantId, tenantId), eq(jobs.id, jobId)))
    .limit(1);
  return job ?? null;
}

export async function completeFetch(tenantId: string, result: WorkerFetchResult): Promise<boolean> {
  const job = await ownedJob(tenantId, result.job_id);
  if (!job) return false;

  const row = {
    text: result.text,
    html: result.html,
    images: result.images,
    meta: result.meta,
    fetchedAt: new Date(),
  };

  await db().transaction(async (tx) => {
    await tx
      .insert(contents)
      .values({ itemId: job.itemId, tenantId, ...row })
      .onConflictDoUpdate({ target: contents.itemId, set: row });

    await tx
      .update(items)
      .set({ title: result.title, status: "summarizing", updatedAt: new Date() })
      .where(and(eq(items.tenantId, tenantId), eq(items.id, job.itemId)));

    await tx.delete(jobs).where(eq(jobs.id, job.id));
    await tx.insert(jobs).values({ tenantId, itemId: job.itemId, kind: "summarize" });
  });

  return true;
}

export async function completeSummarize(tenantId: string, result: WorkerSummarizeResult): Promise<boolean> {
  const job = await ownedJob(tenantId, result.job_id);
  if (!job) return false;

  const summary = {
    model: result.model,
    summaryMd: result.summary_md,
    keyPoints: result.key_points,
    imagePicks: result.image_picks,
    readTimeMin: result.read_time_min,
    tokensIn: result.tokens_in,
    tokensOut: result.tokens_out,
    createdAt: new Date(),
  };

  await db().transaction(async (tx) => {
    await tx
      .insert(summaries)
      .values({ itemId: job.itemId, tenantId, ...summary })
      .onConflictDoUpdate({ target: summaries.itemId, set: summary });

    await tx
      .update(items)
      .set({
        title: result.title,
        tags: normalizeTags(result.tags),
        status: "done",
        error: null,
        updatedAt: new Date(),
      })
      .where(and(eq(items.tenantId, tenantId), eq(items.id, job.itemId)));

    await tx.delete(jobs).where(eq(jobs.id, job.id));
  });

  return true;
}

export async function failJob(tenantId: string, failure: WorkerFailure): Promise<boolean> {
  const job = await ownedJob(tenantId, failure.job_id);
  if (!job) return false;

  if (!failure.retryable || job.attempts >= job.maxAttempts) {
    await db().transaction(async (tx) => {
      await tx.delete(jobs).where(eq(jobs.id, job.id));
      await tx
        .update(items)
        .set({ status: "failed", error: failure.message, updatedAt: new Date() })
        .where(and(eq(items.tenantId, tenantId), eq(items.id, job.itemId)));
    });
    return true;
  }

  await db()
    .update(jobs)
    .set({
      lockedAt: null,
      lockedBy: null,
      lastError: failure.message,
      runAfter: sql`now() + make_interval(mins => ${2 ** job.attempts})`,
    })
    .where(eq(jobs.id, job.id));

  return true;
}

/** Reported back on claim so the worker can tell the tenant what is wrong. */
export async function workerHasKey(tenantId: string): Promise<boolean> {
  const [row] = await db()
    .select({ encrypted: tenantSettings.llmKeyEncrypted })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);
  return Boolean(row?.encrypted);
}
