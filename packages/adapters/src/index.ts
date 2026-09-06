import { articleAdapter } from "./article.js";
import type { Adapter, FetchContext, Fetched } from "./types.js";

export * from "./types.js";
export { extractArticle, articleAdapter } from "./article.js";
export { fetchPage, expectHtml } from "./http.js";
export { absoluteUrl, indexImages, isLikelyContentImage } from "./images.js";

/** Ordered; `article` matches everything, so it stays last. */
export const adapters: Adapter[] = [articleAdapter];

export function pickAdapter(url: URL): Adapter {
  return adapters.find((adapter) => adapter.match(url)) ?? articleAdapter;
}

export function fetchContent(url: URL, ctx: FetchContext): Promise<Fetched> {
  return pickAdapter(url).fetch(url, ctx);
}
