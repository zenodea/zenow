import { contents, eq, items, summaries, type Database } from "@reader/db";
import { log } from "../logger.js";
import { summarize } from "../summarize/index.js";

export async function runSummarizeJob(db: Database, itemId: string): Promise<void> {
  const [row] = await db
    .select({ item: items, content: contents })
    .from(items)
    .innerJoin(contents, eq(contents.itemId, items.id))
    .where(eq(items.id, itemId))
    .limit(1);

  if (!row) {
    log.info("nothing to summarize", { itemId });
    return;
  }

  await db.update(items).set({ status: "summarizing", updatedAt: new Date() }).where(eq(items.id, itemId));

  const result = await summarize({
    sourceType: row.item.sourceType,
    title: row.item.title,
    url: row.item.url,
    text: row.content.text,
    images: row.content.images,
    meta: row.content.meta,
  });

  const summary = {
    model: result.model,
    summaryMd: result.summary_md,
    keyPoints: result.key_points,
    imagePicks: result.image_picks,
    readTimeMin: result.read_time_min,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
    createdAt: new Date(),
  };

  await db
    .insert(summaries)
    .values({ itemId, ...summary })
    .onConflictDoUpdate({ target: summaries.itemId, set: summary });

  // The model returns the title with any site-name suffix stripped.
  await db
    .update(items)
    .set({ title: result.title, status: "done", error: null, updatedAt: new Date() })
    .where(eq(items.id, itemId));

  log.info("summarized", {
    itemId,
    model: result.model,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
  });
}
