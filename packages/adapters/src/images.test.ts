import { parseHTML } from "linkedom";
import { describe, expect, it } from "vitest";
import { absoluteUrl, imagesFromElement, indexImages, isLikelyContentImage, largestFromSrcset } from "./images.js";

const base = new URL("https://example.com/posts/one");

function parse(html: string): ParentNode {
  return parseHTML(`<div>${html}</div>`).document as unknown as ParentNode;
}

describe("absoluteUrl", () => {
  it("resolves relative urls and rejects non-http schemes", () => {
    expect(absoluteUrl("/a/b.png", base)).toBe("https://example.com/a/b.png");
    expect(absoluteUrl("../c.png", base)).toBe("https://example.com/c.png");
    expect(absoluteUrl("data:image/png;base64,iVBOR", base)).toBeNull();
    expect(absoluteUrl("", base)).toBeNull();
    expect(absoluteUrl(undefined, base)).toBeNull();
  });
});

describe("largestFromSrcset", () => {
  it("takes the widest candidate", () => {
    expect(largestFromSrcset("/small.jpg 300w, /big.jpg 1200w, /mid.jpg 800w")).toBe("/big.jpg");
    expect(largestFromSrcset("/a.jpg 1x, /b.jpg 2x")).toBe("/b.jpg");
  });
});

describe("isLikelyContentImage", () => {
  it("keeps real images", () => {
    expect(isLikelyContentImage("https://example.com/chart.png", 800, 600)).toBe(true);
    expect(isLikelyContentImage("https://example.com/photo.jpg")).toBe(true);
  });

  it("drops pixels, icons and anything known to be small", () => {
    expect(isLikelyContentImage("https://example.com/logo.svg")).toBe(false);
    expect(isLikelyContentImage("https://example.com/favicon.ico")).toBe(false);
    expect(isLikelyContentImage("https://analytics.example.com/beacon.png")).toBe(false);
    expect(isLikelyContentImage("https://example.com/t/1x1.png")).toBe(false);
    expect(isLikelyContentImage("https://example.com/thumb.png", 80, 60)).toBe(false);
  });
});

describe("imagesFromElement", () => {
  it("picks the content images out of a mixed block", () => {
    const images = imagesFromElement(
      parse(`
        <figure><img src="/chart.png" width="800" height="600"><figcaption>Latency by percentile</figcaption></figure>
        <img src="https://cdn.example.com/tracking/pixel.gif" width="1" height="1">
        <img src="/icons/logo.svg" alt="Logo">
        <img src="data:image/png;base64,iVBOR" alt="inline">
        <img src="/thumb.png" width="80" height="60" alt="thumb">
        <img srcset="/small.jpg 300w, /big.jpg 1200w" alt="responsive">
        <img data-src="/lazy.png" alt="lazy loaded">
      `),
      base,
    );

    expect(images.map((image) => image.url)).toEqual([
      "https://example.com/chart.png",
      "https://example.com/big.jpg",
      "https://example.com/lazy.png",
    ]);
  });

  it("falls back to a figcaption when alt is missing", () => {
    const [image] = imagesFromElement(
      parse(`<figure><img src="/chart.png"><figcaption>Latency by percentile</figcaption></figure>`),
      base,
    );
    expect(image?.alt).toBe("Latency by percentile");
  });
});

describe("indexImages", () => {
  it("dedupes and numbers what the summarizer will refer back to", () => {
    const images = indexImages([{ url: "https://a/1.png" }, { url: "https://a/1.png" }, { url: "https://a/2.png" }]);
    expect(images).toEqual([
      { index: 0, url: "https://a/1.png" },
      { index: 1, url: "https://a/2.png" },
    ]);
  });

  it("caps how many it keeps", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ url: `https://a/${i}.png` }));
    expect(indexImages(many, 5)).toHaveLength(5);
  });
});
