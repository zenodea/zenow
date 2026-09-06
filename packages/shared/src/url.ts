export const sourceTypes = ["article", "reddit", "youtube"] as const;
export type SourceType = (typeof sourceTypes)[number];

export class InvalidUrlError extends Error {
  constructor(input: string) {
    super(`Not a usable http(s) URL: ${input}`);
    this.name = "InvalidUrlError";
  }
}

const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "gbraid", "wbraid", "msclkid", "dclid", "yclid", "twclid",
  "igshid", "igsh", "mc_cid", "mc_eid", "_hsenc", "_hsmi", "vero_id",
  "ref", "ref_src", "ref_url", "referrer", "source", "spm", "cmpid",
]);
const TRACKING_PREFIXES = ["utm_", "pk_", "mtm_", "hsa_"];

const YOUTUBE_HOSTS = new Set([
  "youtube.com", "m.youtube.com", "music.youtube.com", "youtube-nocookie.com",
]);
const YOUTUBE_PATH_IDS = new Set(["shorts", "live", "embed", "v"]);
const VIDEO_ID = /^[\w-]{11}$/;

const REDDIT_HOST = /^(?:[a-z0-9-]+\.)?reddit\.com$/;
const POST_ID = /^[a-z0-9]{4,12}$/i;

function toUrl(input: string | URL): URL {
  if (input instanceof URL) return input;
  const trimmed = input.trim();
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new InvalidUrlError(input);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new InvalidUrlError(input);
  return url;
}

function bareHost(url: URL): string {
  return url.hostname.toLowerCase().replace(/^www\./, "");
}

function segments(url: URL): string[] {
  return url.pathname.split("/").filter(Boolean);
}

export function youtubeVideoId(input: string | URL): string | null {
  let url: URL;
  try {
    url = toUrl(input);
  } catch {
    return null;
  }
  const host = bareHost(url);
  const segs = segments(url);

  let id: string | null = null;
  if (host === "youtu.be") id = segs[0] ?? null;
  else if (!YOUTUBE_HOSTS.has(host)) return null;
  else if (segs[0] === "watch") id = url.searchParams.get("v");
  else if (segs[0] && YOUTUBE_PATH_IDS.has(segs[0])) id = segs[1] ?? null;

  return id && VIDEO_ID.test(id) ? id : null;
}

export function redditPostId(input: string | URL): string | null {
  let url: URL;
  try {
    url = toUrl(input);
  } catch {
    return null;
  }
  const host = bareHost(url);
  const segs = segments(url);

  let id: string | null = null;
  if (host === "redd.it") id = segs[0] ?? null;
  else if (!REDDIT_HOST.test(host)) return null;
  else {
    const i = segs.indexOf("comments");
    if (i >= 0) id = segs[i + 1] ?? null;
  }

  return id && POST_ID.test(id) ? id : null;
}

/** `/r/<sub>/s/<code>` share links only resolve by following the redirect. */
export function isRedditShareLink(input: string | URL): boolean {
  let url: URL;
  try {
    url = toUrl(input);
  } catch {
    return false;
  }
  if (!REDDIT_HOST.test(bareHost(url))) return false;
  const segs = segments(url);
  return segs[0] === "r" && segs[2] === "s" && Boolean(segs[3]);
}

export function detectSourceType(input: string | URL): SourceType {
  if (youtubeVideoId(input)) return "youtube";
  if (redditPostId(input) || isRedditShareLink(input)) return "reddit";
  return "article";
}

/**
 * Stable dedup key. Not necessarily fetchable — the worker always fetches
 * `items.url`, which is exactly what the user saved.
 */
export function canonicalizeUrl(input: string): string {
  const url = toUrl(input);

  const videoId = youtubeVideoId(url);
  if (videoId) return `https://youtube.com/watch?v=${videoId}`;

  const postId = redditPostId(url);
  if (postId) return `https://reddit.com/comments/${postId.toLowerCase()}`;

  url.protocol = url.protocol.toLowerCase();
  url.hostname = bareHost(url);
  url.hash = "";
  url.username = "";
  url.password = "";

  for (const key of [...url.searchParams.keys()]) {
    const k = key.toLowerCase();
    if (TRACKING_PARAMS.has(k) || TRACKING_PREFIXES.some((p) => k.startsWith(p))) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();

  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, "");

  return url.toString();
}
