import { articleAdapter } from "./article.js";
import { pdfAdapter } from "./pdf.js";
import { redditAdapter } from "./reddit.js";
import { youtubeAdapter } from "./youtube.js";
import type { Adapter, FetchContext, Fetched } from "./types.js";

export * from "./types.js";
export { extractArticle, articleAdapter } from "./article.js";
export { redditAdapter, fetchRedditPost } from "./reddit.js";
export { youtubeAdapter, vttToText } from "./youtube.js";
export { pdfAdapter, extractPdf } from "./pdf.js";
export { fetchPage, fetchBytes, expectHtml, isPdf } from "./http.js";
export { absoluteUrl, indexImages, isLikelyContentImage } from "./images.js";

/** Ordered; `article` matches everything, so it stays last. */
export const adapters: Adapter[] = [redditAdapter, youtubeAdapter, pdfAdapter, articleAdapter];

export function pickAdapter(url: URL): Adapter {
  return adapters.find((adapter) => adapter.match(url)) ?? articleAdapter;
}

export function fetchContent(url: URL, ctx: FetchContext): Promise<Fetched> {
  return pickAdapter(url).fetch(url, ctx);
}
