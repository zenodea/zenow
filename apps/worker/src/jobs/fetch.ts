import { fetchContent } from "@zenow/adapters";
import { contents, eq, items, type Database, type Sql } from "@zenow/db";
import { env } from "../env.js";
import { log } from "../logger.js";
import { enqueue } from "../queue.js";
import { waitForHost } from "../ratelimit.js";

/**
 * Fetches items.url -- what the user actually saved -- rather than the
 * canonical url, which is a dedup key and not guaranteed to be fetchable.
 */
export async function runFetchJob(db: Database, sql: Sql, itemId: string): Promise<void> {
  const [item] = await db.select().from(items).where(eq(items.id, itemId)).limit(1);
  if (!item) {
    log.info("item vanished before fetch", { itemId });
    return;
  }

  await db.update(items).set({ status: "fetching", updatedAt: new Date() }).where(eq(items.id, item.id));

  const url = new URL(item.url);
  await waitForHost(url.host);

  const fetched = await fetchContent(url, {
    fetch,
    log,
    ...(env.redditClientId && env.redditClientSecret
      ? { reddit: { clientId: env.redditClientId, clientSecret: env.redditClientSecret } }
      : {}),
  });

  const row = {
    text: fetched.text,
    html: fetched.html ?? null,
    images: fetched.images,
    meta: fetched.meta,
    fetchedAt: new Date(),
  };

  await db
    .insert(contents)
    .values({ itemId: item.id, ...row })
    .onConflictDoUpdate({ target: contents.itemId, set: row });

  await db
    .update(items)
    .set({ title: fetched.title, status: "summarizing", updatedAt: new Date() })
    .where(eq(items.id, item.id));

  await enqueue(sql, item.id, "summarize");

  log.info("fetched", {
    itemId: item.id,
    host: url.host,
    chars: fetched.text.length,
    images: fetched.images.length,
  });
}
