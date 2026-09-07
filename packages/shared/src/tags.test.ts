import { describe, expect, it } from "vitest";
import { normalizeTag, normalizeTags } from "./tags.js";

describe("normalizeTag", () => {
  it("collapses the ways a model writes the same tag", () => {
    for (const variant of ["Machine Learning", "machine_learning", "machine/learning", "  MACHINE  LEARNING "]) {
      expect(normalizeTag(variant)).toBe("machine-learning");
    }
  });

  it("strips punctuation and stray dashes", () => {
    expect(normalizeTag("C++!")).toBe("c");
    expect(normalizeTag("--rust--")).toBe("rust");
    expect(normalizeTag("web   dev")).toBe("web-dev");
  });

  it("rejects what cannot become a tag", () => {
    expect(normalizeTag("")).toBeNull();
    expect(normalizeTag("!!!")).toBeNull();
    expect(normalizeTag("a".repeat(40))).toBeNull();
  });
});

describe("normalizeTags", () => {
  it("dedupes variants of one tag and keeps order", () => {
    expect(normalizeTags(["Rust", "rust", "Systems Programming"])).toEqual(["rust", "systems-programming"]);
  });

  it("caps how many survive", () => {
    expect(normalizeTags(["a", "b", "c", "d", "e", "f", "g", "h"])).toHaveLength(3);
  });

  it("drops unusable entries without dropping the rest", () => {
    expect(normalizeTags(["ok", "!!!", "fine"])).toEqual(["ok", "fine"]);
  });
});
