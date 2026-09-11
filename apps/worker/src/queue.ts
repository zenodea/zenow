import type { JobKind } from "@zenow/shared";
import type { Sql } from "@zenow/db";

export type ClaimedJob = {
  id: number;
  tenantId: string;
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
    returning id, tenant_id, item_id, kind, attempts, max_attempts
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: Number(row.id),
    tenantId: row.tenant_id as string,
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
  await sql.begin(async (tx) => {
    await tx`
      update jobs
         set locked_at = null,
             locked_by = null,
             last_error = ${message},
             run_after = now() + make_interval(mins => ${backoffMinutes})
       where id = ${job.id}
    `;
    // Also on the item, so the UI can say why it is still working rather than
    // showing "Fetching" with no explanation for half an hour.
    await tx`update items set error = ${message} where id = ${job.itemId}`;
  });
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

/**
 * An item in a working state with no job left is stranded: nothing will ever
 * move it again. That should not happen, but a crash between enqueueing the
 * next job and deleting the current one, or a job row removed by hand, both
 * produce it -- and the item then says "Fetching" forever.
 *
 * The age guard keeps this clear of anything genuinely in flight.
 */
export async function requeueStrandedItems(sql: Sql, olderThanMinutes = 15): Promise<number> {
  const rows = await sql`
    insert into jobs (tenant_id, item_id, kind)
    select i.tenant_id,
           i.id,
           case
             when i.source_type = 'research' and c.item_id is null then 'research'::job_kind
             when c.item_id is null then 'fetch'::job_kind
             else 'summarize'::job_kind
           end
      from items i
      left join jobs j on j.item_id = i.id
      left join contents c on c.item_id = i.id
     where i.status in ('queued', 'fetching', 'summarizing')
       and j.id is null
       and i.updated_at < now() - make_interval(mins => ${olderThanMinutes})
    returning id
  `;
  return rows.length;
}

export async function enqueue(sql: Sql, tenantId: string, itemId: string, kind: JobKind): Promise<void> {
  await sql`insert into jobs (tenant_id, item_id, kind) values (${tenantId}, ${itemId}, ${kind})`;
}
