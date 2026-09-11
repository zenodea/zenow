import { fetchContent } from "@zenow/adapters";
import { and, contents, eq, items, type Database, type Sql } from "@zenow/db";
import type { ImageRef } from "@zenow/shared";
import { writeYoutubeCookies } from "../cookies.js";
import { env } from "../env.js";
import { errorMessage, log } from "../logger.js";
import { enqueue } from "../queue.js";
import { waitForHost } from "../ratelimit.js";
import { credentialsFor } from "./credentials.js";
import { research } from "../summarize/research.js";

/** How many cited pages are opened looking for a picture worth showing. */
const SOURCES_FOR_IMAGES = 4;
const MAX_IMAGES = 8;

/**
 * Research produces an item like any other, so the feed, tags, search and the
 * reading view all work on it unchanged. It has no url of its own, so it gets
 * a zenow: one -- unique per item, and never fetched.
 */
export async function runResearchJob(db: Database, sql: Sql, tenantId: string, itemId: string): Promise<void> {
  const [item] = await db
    .select()
    .from(items)
    .where(and(eq(items.tenantId, tenantId), eq(items.id, itemId)))
    .limit(1);

  if (!item) {
    log.info("item vanished before research", { itemId });
    return;
  }

  await db.update(items).set({ status: "fetching", updatedAt: new Date() }).where(eq(items.id, item.id));

  // The question is kept in meta because the summarizer rewrites items.title
  // into a headline. Re-running a finished piece of research off the title
  // would research the headline instead of what was actually asked.
  const [existing] = await db.select().from(contents).where(eq(contents.itemId, item.id)).limit(1);
  const stored = existing?.meta?.["prompt"];
  const prompt = (typeof stored === "string" && stored.trim() ? stored : (item.title ?? "")).trim();

  if (!prompt) throw new Error("This research item has no question to work from.");

  const findings = await research(prompt, await credentialsFor(db, tenantId));

  // Cited pages are opened with the ordinary adapters, which means the SSRF
  // guard and the per-host rate limit apply to them exactly as they do to a
  // link someone pasted.
  const cookiesPath = writeYoutubeCookies();
  const images: ImageRef[] = [];
  const readSources: string[] = [];

  for (const citation of findings.citations.slice(0, SOURCES_FOR_IMAGES)) {
    if (images.length >= MAX_IMAGES) break;
    try {
      const url = new URL(citation.url);
      await waitForHost(url.host);
      const fetched = await fetchContent(url, {
        fetch,
        log,
        ...(env.redditClientId && env.redditClientSecret
          ? { reddit: { clientId: env.redditClientId, clientSecret: env.redditClientSecret } }
          : {}),
        ...(cookiesPath ? { youtubeCookiesPath: cookiesPath } : {}),
      });
      readSources.push(citation.url);
      for (const image of fetched.images) {
        if (images.length >= MAX_IMAGES) break;
        images.push({ ...image, index: images.length });
      }
    } catch (error) {
      // A source that will not open is normal and not worth failing over.
      log.info("could not read a cited source", { url: citation.url, error: errorMessage(error) });
    }
  }

  const sources = findings.citations.map((c, i) => `${i + 1}. ${c.title} — ${c.url}`).join("\n");
  const text = `${findings.text}\n\nSources:\n${sources}`;

  const row = {
    text,
    html: null,
    images,
    meta: {
      prompt,
      research_model: findings.tokensIn ? "perplexity/sonar" : undefined,
      citations: findings.citations,
      sources_read: readSources.length,
      research_tokens_in: findings.tokensIn,
      research_tokens_out: findings.tokensOut,
    },
    fetchedAt: new Date(),
  };

  await db
    .insert(contents)
    .values({ itemId: item.id, tenantId, ...row })
    .onConflictDoUpdate({ target: contents.itemId, set: row });

  await db
    .update(items)
    .set({ status: "summarizing", updatedAt: new Date() })
    .where(eq(items.id, item.id));

  await enqueue(sql, tenantId, item.id, "summarize");

  log.info("researched", {
    itemId: item.id,
    citations: findings.citations.length,
    sourcesRead: readSources.length,
    images: images.length,
    tokensIn: findings.tokensIn,
    tokensOut: findings.tokensOut,
  });
}
