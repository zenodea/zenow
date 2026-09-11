import {
  and,
  contents,
  decryptSecret,
  desc,
  eq,
  items,
  sql,
  summaries,
  tenantSettings,
  type Database,
} from "@zenow/db";
import { normalizeTags } from "@zenow/shared";
import { log } from "../logger.js";
import { env } from "../env.js";
import { summarize } from "../summarize/index.js";
import { credentialsFor } from "./credentials.js";

const VOCABULARY_SIZE = 40;

/** The tags already in use, most common first, with their usage counts. */
async function knownTags(db: Database, tenantId: string): Promise<{ tag: string; uses: number }[]> {
  return db
    .select({ tag: sql<string>`tag`, uses: sql<number>`count(*)::int` })
    .from(sql`items, unnest(items.tags) as tag`)
    .where(eq(items.tenantId, tenantId))
    .groupBy(sql`tag`)
    .orderBy(desc(sql`count(*)`), sql`tag`)
    .limit(VOCABULARY_SIZE);
}

export async function runSummarizeJob(db: Database, tenantId: string, itemId: string): Promise<void> {
  const [row] = await db
    .select({ item: items, content: contents })
    .from(items)
    .innerJoin(contents, eq(contents.itemId, items.id))
    .where(and(eq(items.tenantId, tenantId), eq(items.id, itemId)))
    .limit(1);

  if (!row) {
    log.info("nothing to summarize", { itemId });
    return;
  }

  await db
    .update(items)
    .set({ status: "summarizing", updatedAt: new Date() })
    .where(and(eq(items.tenantId, tenantId), eq(items.id, itemId)));

  const result = await summarize(
    {
      sourceType: row.item.sourceType,
      title: row.item.title,
      url: row.item.url,
      text: row.content.text,
      images: row.content.images,
      meta: row.content.meta,
      knownTags: await knownTags(db, tenantId),
    },
    await credentialsFor(db, tenantId),
  );

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
    .values({ itemId, tenantId, ...summary })
    .onConflictDoUpdate({ target: summaries.itemId, set: summary });

  const tags = normalizeTags(result.tags);

  // The model returns the title with any site-name suffix stripped.
  await db
    .update(items)
    .set({ title: result.title, tags, status: "done", error: null, updatedAt: new Date() })
    .where(and(eq(items.tenantId, tenantId), eq(items.id, itemId)));

  log.info("summarized", {
    itemId,
    model: result.model,
    tags,
    tokensIn: result.tokensIn,
    tokensOut: result.tokensOut,
  });
}
