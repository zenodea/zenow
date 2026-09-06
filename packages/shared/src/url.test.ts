import { describe, expect, it } from "vitest";
import {
  InvalidUrlError,
  canonicalizeUrl,
  detectSourceType,
  isRedditShareLink,
  redditPostId,
  youtubeVideoId,
} from "./url.js";

describe("canonicalizeUrl", () => {
  it("strips tracking params but keeps real ones", () => {
    expect(canonicalizeUrl("https://example.com/a?utm_source=x&id=1&fbclid=z&ref=hn")).toBe(
      "https://example.com/a?id=1",
    );
    expect(canonicalizeUrl("https://example.com/a?pk_campaign=1&q=2")).toBe("https://example.com/a?q=2");
  });

  it("normalises host, scheme-less input, slashes and fragments", () => {
    expect(canonicalizeUrl("https://WWW.Example.COM/a/")).toBe("https://example.com/a");
    expect(canonicalizeUrl("example.com/a")).toBe("https://example.com/a");
    expect(canonicalizeUrl("https://example.com")).toBe("https://example.com/");
    expect(canonicalizeUrl("https://example.com/a#section")).toBe("https://example.com/a");
  });

  it("sorts query params so order does not create duplicates", () => {
    expect(canonicalizeUrl("https://example.com/a?b=2&a=1")).toBe(canonicalizeUrl("https://example.com/a?a=1&b=2"));
  });

  it("collapses every youtube url shape onto the video id", () => {
    const want = "https://youtube.com/watch?v=dQw4w9WgXcQ";
    for (const url of [
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&si=abc",
      "https://youtu.be/dQw4w9WgXcQ?si=xyz",
      "https://youtube.com/shorts/dQw4w9WgXcQ",
      "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    ]) {
      expect(canonicalizeUrl(url)).toBe(want);
    }
  });

  it("collapses every reddit post url shape onto the post id", () => {
    const want = "https://reddit.com/comments/1abc234";
    for (const url of [
      "https://www.reddit.com/r/selfhosted/comments/1abc234/some_title_slug/",
      "https://old.reddit.com/r/selfhosted/comments/1abc234/some_title_slug/?sort=top",
      "https://reddit.com/comments/1abc234",
      "https://redd.it/1abc234",
    ]) {
      expect(canonicalizeUrl(url)).toBe(want);
    }
  });

  it("ignores the comment id when a permalink points at one comment", () => {
    expect(canonicalizeUrl("https://reddit.com/r/x/comments/1abc234/slug/def5678/")).toBe(
      "https://reddit.com/comments/1abc234",
    );
  });

  it("is idempotent", () => {
    for (const url of [
      "https://example.com/a?utm_source=x&id=1",
      "https://youtu.be/dQw4w9WgXcQ",
      "https://www.reddit.com/r/x/comments/1abc234/slug/",
      "https://example.com",
    ]) {
      expect(canonicalizeUrl(canonicalizeUrl(url))).toBe(canonicalizeUrl(url));
    }
  });

  it("rejects anything that is not fetchable http(s)", () => {
    for (const bad of ["javascript:alert(1)", "ftp://example.com/x", "not a url", ""]) {
      expect(() => canonicalizeUrl(bad)).toThrow(InvalidUrlError);
    }
  });
});

describe("id extraction", () => {
  it("reads youtube video ids only when they are well formed", () => {
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtube.com/@somechannel")).toBeNull();
    expect(youtubeVideoId("https://youtube.com/watch?v=tooshort")).toBeNull();
    expect(youtubeVideoId("https://example.com/watch?v=dQw4w9WgXcQ")).toBeNull();
  });

  it("reads reddit post ids without confusing media hosts", () => {
    expect(redditPostId("https://redd.it/1abc234")).toBe("1abc234");
    expect(redditPostId("https://i.redd.it/abcd1234.jpg")).toBeNull();
    expect(redditPostId("https://v.redd.it/abcd1234")).toBeNull();
    expect(redditPostId("https://reddit.com/r/selfhosted")).toBeNull();
  });

  it("spots share links that only resolve by redirect", () => {
    expect(isRedditShareLink("https://www.reddit.com/r/selfhosted/s/AbCdEf1234")).toBe(true);
    expect(isRedditShareLink("https://www.reddit.com/r/selfhosted/comments/1abc234/x/")).toBe(false);
  });
});

describe("detectSourceType", () => {
  it("routes by what the url actually points at", () => {
    expect(detectSourceType("https://example.com/blog/post")).toBe("article");
    expect(detectSourceType("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(detectSourceType("https://reddit.com/r/x/comments/1abc234/slug")).toBe("reddit");
    expect(detectSourceType("https://reddit.com/r/x/s/AbCdEf1234")).toBe("reddit");
  });

  it("treats listing and channel pages as plain articles", () => {
    expect(detectSourceType("https://youtube.com/@somechannel")).toBe("article");
    expect(detectSourceType("https://reddit.com/r/selfhosted")).toBe("article");
  });
});
