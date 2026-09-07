import { describe, expect, it } from "vitest";
import { splitIntoChunks } from "./chunk.js";

describe("splitIntoChunks", () => {
  it("leaves text that already fits as one chunk", () => {
    expect(splitIntoChunks("one\n\ntwo", 100)).toEqual(["one\n\ntwo"]);
  });

  it("breaks on paragraph boundaries rather than mid-sentence", () => {
    const chunks = splitIntoChunks("aaaa\n\nbbbb\n\ncccc", 10);
    expect(chunks).toEqual(["aaaa\n\nbbbb", "cccc"]);
    for (const chunk of chunks) expect(chunk.length).toBeLessThanOrEqual(10);
  });

  it("hard-splits a paragraph that is itself over the budget", () => {
    const chunks = splitIntoChunks("x".repeat(25), 10);
    expect(chunks).toEqual(["x".repeat(10), "x".repeat(10), "x".repeat(5)]);
  });

  it("flushes what it has before hard-splitting, so order is preserved", () => {
    const chunks = splitIntoChunks(`short\n\n${"y".repeat(25)}\n\ntail`, 10);
    expect(chunks[0]).toBe("short");
    expect(chunks.slice(1, 4)).toEqual(["y".repeat(10), "y".repeat(10), "y".repeat(5)]);
    expect(chunks.at(-1)).toBe("tail");
    expect(chunks.join("")).toContain("short");
  });

  it("loses no text", () => {
    const text = Array.from({ length: 30 }, (_, i) => `paragraph number ${i}`).join("\n\n");
    const rejoined = splitIntoChunks(text, 60).join("\n\n");
    expect(rejoined.replace(/\s+/g, " ")).toBe(text.replace(/\s+/g, " "));
  });

  it("returns nothing for empty input", () => {
    expect(splitIntoChunks("", 10)).toEqual([]);
  });
});
