import type { JobKind } from "@reader/shared";
import type { Sql } from "@reader/db";

export type ClaimedJob = {
  id: number;
  itemId: string;
  kind: JobKind;
  attempts: number;
  maxAttempts: number;
};

/**
 * SKIP LOCKED lets several workers drain the same queue without ever handing
 * the same row to two of them. attempts is incremented on claim, so a worker
 * that dies mid-job still burns an attempt and cannot spin forever.
 */
export async function claimJob(sql: Sql, workerId: string): Promise<ClaimedJob | null> {
  const rows = await sql`
    update jobs
       set locked_at = now(),
           locked_by = ${workerId},
           attempts = attempts + 1
     where id = (
       select id from jobs
        where locked_at is null
          and run_after <= now()
        order by created_at
        limit 1
        for update skip locked
     )
    returning id, item_id, kind, attempts, max_attempts
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    itemId: row.item_id as string,
    kind: row.kind as JobKind,
    attempts: row.attempts as number,
    maxAttempts: row.max_attempts as number,
  };
}

export async function completeJob(sql: Sql, jobId: number): Promise<void> {
  await sql`delete from jobs where id = ${jobId}`;
}

export type FailureOutcome = "retrying" | "gave_up";

/**
 * Retryable failures back off exponentially; anything else, or a job out of
 * attempts, marks the item failed so the reason is visible in the UI.
 */
export async function failJob(
  sql: Sql,
  job: ClaimedJob,
  message: string,
  retryable: boolean,
): Promise<FailureOutcome> {
  if (!retryable || job.attempts >= job.maxAttempts) {
    await sql.begin(async (tx) => {
      await tx`delete from jobs where id = ${job.id}`;
      await tx`update items
                  set status = 'failed', error = ${message}, updated_at = now()
                where id = ${job.itemId}`;
    });
    return "gave_up";
  }

  const backoffMinutes = 2 ** job.attempts;
  await sql`
    update jobs
       set locked_at = null,
           locked_by = null,
           last_error = ${message},
           run_after = now() + make_interval(mins => ${backoffMinutes})
     where id = ${job.id}
  `;
  return "retrying";
}

/** A worker killed mid-job leaves a lock behind; nothing else would free it. */
export async function sweepStaleLocks(sql: Sql, olderThanMinutes: number): Promise<number> {
  const rows = await sql`
    update jobs
       set locked_at = null, locked_by = null
     where locked_at < now() - make_interval(mins => ${olderThanMinutes})
    returning id
  `;
  return rows.length;
}

export async function enqueue(sql: Sql, itemId: string, kind: JobKind): Promise<void> {
  await sql`insert into jobs (item_id, kind) values (${itemId}, ${kind})`;
}
