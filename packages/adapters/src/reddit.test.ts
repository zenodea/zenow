import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { fetchRedditPost } from "./reddit.js";
import { AdapterError, type FetchContext } from "./types.js";

const body = readFileSync(join(import.meta.dirname, "..", "fixtures", "reddit-post.json"), "utf8");

const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };

function contextReturning(payload: string, status = 200): FetchContext {
  return {
    log,
    fetch: vi.fn(async () =>
      new Response(payload, { status, headers: { "content-type": "application/json" } }),
    ) as unknown as typeof fetch,
  };
}

describe("fetchRedditPost", () => {
  it("builds text from the post and the top comments", async () => {
    const result = await fetchRedditPost("1abc234", contextReturning(body));

    expect(result.title).toBe("What is your favourite self-hosted backup setup?");
    expect(result.text).toContain("running restic to B2");
    expect(result.text).toContain("> alice (88): restic + B2 here too.");
    // one level of replies is kept, and indented
    expect(result.text).toContain("  > bob (31): Same, though pruning is slow on big repos.");
    expect(result.text).toContain("> carol (45): borgmatic. Been rock solid.");
  });

  it("ignores 'more' stubs that carry no body", async () => {
    const result = await fetchRedditPost("1abc234", contextReturning(body));
    expect(result.meta.comments_included).toBe(3);
    expect(result.text).not.toContain("undefined");
  });

  it("keeps subreddit, score and timestamps as metadata", async () => {
    const result = await fetchRedditPost("1abc234", contextReturning(body));
    expect(result.meta.subreddit).toBe("selfhosted");
    expect(result.meta.score).toBe(412);
    expect(result.meta.published_at).toBe("2025-01-01T00:00:00.000Z");
    expect(result.meta.authenticated).toBe(false);
  });

  it("decodes the html entities reddit puts in image urls", async () => {
    const result = await fetchRedditPost("1abc234", contextReturning(body));
    const preview = result.images.find((image) => image.url.includes("preview.redd.it"));
    expect(preview?.url).toBe("https://preview.redd.it/chart.png?width=1200&auto=webp");
  });

  it("says what is actually wrong when reddit refuses an anonymous request", async () => {
    await expect(fetchRedditPost("1abc234", contextReturning("blocked", 403))).rejects.toThrow(
      /REDDIT_CLIENT_ID/,
    );
  });

  it("does not treat a garbled body as an empty post", async () => {
    await expect(fetchRedditPost("1abc234", contextReturning("<html>nope</html>"))).rejects.toThrow(
      AdapterError,
    );
  });
});
