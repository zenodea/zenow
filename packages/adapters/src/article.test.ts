import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { extractArticle } from "./article.js";
import { AdapterError } from "./types.js";

const fixtureDir = join(import.meta.dirname, "..", "fixtures");
const manifest: { name: string; url: string }[] = JSON.parse(
  readFileSync(join(fixtureDir, "manifest.json"), "utf8"),
);

function fixture(name: string) {
  const entry = manifest.find((f) => f.name === name);
  if (!entry) throw new Error(`no fixture named ${name}`);
  return { html: readFileSync(join(fixtureDir, `${name}.html`), "utf8"), url: new URL(entry.url) };
}

describe("extractArticle against saved pages", () => {
  it.each(manifest.map((f) => f.name))("%s yields a title, body text and usable images", (name) => {
    const { html, url } = fixture(name);
    const result = extractArticle(html, url);

    expect(result.title.length).toBeGreaterThan(5);
    expect(result.text.length).toBeGreaterThan(1000);
    expect(result.html).toBeTruthy();
    expect(result.meta.url).toBe(url.toString());

    for (const image of result.images) {
      expect(image.url).toMatch(/^https?:\/\//);
    }
    expect(result.images.map((i) => i.index)).toEqual(result.images.map((_, i) => i));
  });

  it("reads a page that omits <head> and <body> entirely", () => {
    // danluu.com ships bare html; linkedom leaves those nodes outside <body>.
    const { html, url } = fixture("danluu");
    const result = extractArticle(html, url);

    expect(result.title).toBe("Goodhearting IQ, cholesterol, and tail latency");
    expect(result.text.length).toBeGreaterThan(5000);
  });

  it("keeps open graph metadata and image alt text", () => {
    const { html, url } = fixture("simonwillison");
    const result = extractArticle(html, url);

    expect(result.meta.author).toBe("Simon Willison");
    expect(result.meta.canonical).toBe(url.toString());
    expect(result.images.some((image) => image.alt)).toBe(true);
  });
});

describe("extractArticle failure modes", () => {
  it("flags a client-rendered shell instead of storing an empty body", () => {
    const shell = `<!doctype html><html><head><title>App</title></head>
      <body><div id="root"></div><script src="/app.js"></script></body></html>`;

    try {
      extractArticle(shell, new URL("https://example.com/dashboard"));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AdapterError);
      expect((error as AdapterError).code).toBe("needs_browser");
      expect((error as AdapterError).retryable).toBe(false);
    }
  });

  it("resolves relative image urls against <base href>", () => {
    const prose = "Ordinary article prose that exists only to clear the length threshold. ".repeat(12);
    const html = `<!doctype html><html><head><base href="https://cdn.example.com/v2/"></head>
      <body><article><p>${prose}</p><img src="chart.png" width="900" height="600" alt="chart"></article></body></html>`;

    const result = extractArticle(html, new URL("https://example.com/post"));
    expect(result.images[0]?.url).toBe("https://cdn.example.com/v2/chart.png");
  });
});
