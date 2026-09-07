import { isRedditShareLink, redditPostId } from "@reader/shared";
import { fetchPage } from "./http.js";
import { absoluteUrl, indexImages, isLikelyContentImage, type RawImage } from "./images.js";
import { AdapterError, type Adapter, type FetchContext, type Fetched } from "./types.js";

const MAX_COMMENTS = 25;
const MAX_DEPTH = 2;
const USER_AGENT = "web:reader:1.0 (personal reading list)";

type RedditPost = {
  title?: string;
  selftext?: string;
  author?: string;
  subreddit?: string;
  score?: number;
  num_comments?: number;
  created_utc?: number;
  is_video?: boolean;
  is_self?: boolean;
  url?: string;
  domain?: string;
  permalink?: string;
  post_hint?: string;
  thumbnail?: string;
  preview?: { images?: { source?: { url?: string; width?: number; height?: number } }[] };
  media_metadata?: Record<string, { s?: { u?: string; x?: number; y?: number } }>;
};

type RedditComment = {
  kind?: string;
  data?: {
    body?: string;
    author?: string;
    score?: number;
    depth?: number;
    replies?: { data?: { children?: RedditComment[] } } | "";
  };
};

let cachedToken: { value: string; expiresAt: number } | undefined;

async function accessToken(ctx: FetchContext): Promise<string | null> {
  if (!ctx.reddit) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;

  const basic = Buffer.from(`${ctx.reddit.clientId}:${ctx.reddit.clientSecret}`).toString("base64");
  const response = await ctx.fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": USER_AGENT,
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    ctx.log.warn("reddit oauth failed, falling back to public json", { status: response.status });
    return null;
  }

  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return null;

  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 };
  return cachedToken.value;
}

/** `/r/<sub>/s/<code>` only resolves by following the redirect. */
async function resolveShareLink(url: URL, ctx: FetchContext): Promise<string | null> {
  const response = await ctx.fetch(url.toString(), {
    redirect: "follow",
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(10_000),
  });
  return redditPostId(response.url);
}

/** Reddit html-escapes urls inside json (&amp;) even with raw_json=1 in places. */
function decodeEntities(value: string): string {
  return value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
}

function collectImages(post: RedditPost): RawImage[] {
  const out: RawImage[] = [];
  const push = (raw: string | undefined, width?: number, height?: number) => {
    const url = absoluteUrl(raw ? decodeEntities(raw) : undefined, new URL("https://reddit.com"));
    if (url && isLikelyContentImage(url, width, height)) out.push({ url, ...(width ? { width } : {}), ...(height ? { height } : {}) });
  };

  if (post.post_hint === "image") push(post.url);
  for (const entry of Object.values(post.media_metadata ?? {})) push(entry.s?.u, entry.s?.x, entry.s?.y);
  for (const image of post.preview?.images ?? []) push(image.source?.url, image.source?.width, image.source?.height);

  return out;
}

/** Top comments only, shallow, flattened -- the summarizer reads plain text. */
function flattenComments(children: RedditComment[], depth = 0, out: string[] = []): string[] {
  for (const child of children) {
    if (out.length >= MAX_COMMENTS) break;
    if (child.kind !== "t1" || !child.data?.body) continue;

    const { author = "unknown", score = 0, body } = child.data;
    out.push(`${"  ".repeat(depth)}> ${author} (${score}): ${body.trim()}`);

    const replies = child.data.replies;
    if (depth + 1 <= MAX_DEPTH && replies && typeof replies !== "string") {
      flattenComments(replies.data?.children ?? [], depth + 1, out);
    }
  }
  return out;
}

export async function fetchRedditPost(postId: string, ctx: FetchContext): Promise<Fetched> {
  const token = await accessToken(ctx);
  const base = token ? "https://oauth.reddit.com" : "https://www.reddit.com";
  const url = new URL(`${base}/comments/${postId}.json?limit=100&sort=top&raw_json=1`);

  let page;
  try {
    page = await fetchPage(url, ctx, {
      accept: "application/json",
      headers: {
        "user-agent": USER_AGENT,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
  } catch (error) {
    if (!token && error instanceof AdapterError && error.code === "blocked") {
      throw new AdapterError(
        "blocked",
        "Reddit refuses unauthenticated requests. Set REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET on the worker.",
        { cause: error },
      );
    }
    throw error;
  }

  let listings: [{ data?: { children?: { data?: RedditPost }[] } }, { data?: { children?: RedditComment[] } }];
  try {
    listings = JSON.parse(page.body);
  } catch (cause) {
    throw new AdapterError("no_content", "Reddit did not return json", { cause });
  }

  const post = listings[0]?.data?.children?.[0]?.data;
  if (!post?.title) throw new AdapterError("no_content", `Reddit post ${postId} has no content`);

  const comments = flattenComments(listings[1]?.data?.children ?? []);
  const body = post.selftext?.trim();

  const text = [
    post.title,
    body ? `\n${body}` : "",
    !body && post.url && !post.is_self ? `\nLink: ${post.url}` : "",
    comments.length ? `\n\nTop comments:\n${comments.join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  return {
    title: post.title,
    text,
    images: indexImages(collectImages(post)),
    meta: {
      subreddit: post.subreddit,
      author: post.author,
      score: post.score,
      num_comments: post.num_comments,
      published_at: post.created_utc ? new Date(post.created_utc * 1000).toISOString() : undefined,
      is_video: post.is_video ?? false,
      link_domain: post.is_self ? undefined : post.domain,
      comments_included: comments.length,
      authenticated: Boolean(token),
    },
  };
}

export const redditAdapter: Adapter = {
  name: "reddit",
  match: (url) => Boolean(redditPostId(url) || isRedditShareLink(url)),
  async fetch(url, ctx) {
    const postId = redditPostId(url) ?? (await resolveShareLink(url, ctx));
    if (!postId) throw new AdapterError("unsupported", `Could not find a reddit post id in ${url}`);
    return fetchRedditPost(postId, ctx);
  },
};
