import { describe, expect, it } from "vitest";
import { markdownToSpeech, speechChunks } from "./speech.js";

describe("markdownToSpeech", () => {
  it("reads a link as its label, not its url", () => {
    expect(markdownToSpeech("See [the paper](https://arxiv.org/abs/1706.03762) for more.")).toBe(
      "See the paper for more.",
    );
  });

  it("drops the punctuation that only means something on a page", () => {
    const markdown = "## Findings\n\n- **Latency** fell by _half_\n- Cost `$0.20` per run";
    expect(markdownToSpeech(markdown)).toBe("Findings. Latency fell by half. Cost $0.20 per run.");
  });

  it("does not read code blocks aloud", () => {
    expect(markdownToSpeech("Before\n\n```js\nconst x = 1;\n```\n\nAfter")).toBe("Before. After");
  });
});

describe("speechChunks", () => {
  it("splits on sentences and keeps them whole", () => {
    const chunks = speechChunks("One thing happened. Then another. Finally a third.", 30);
    expect(chunks).toEqual(["One thing happened.", "Then another. Finally a third."]);
  });

  it("packs short sentences together rather than one utterance each", () => {
    expect(speechChunks("A. B. C.", 240)).toEqual(["A. B. C."]);
  });

  it("breaks a sentence that is longer than the budget at a comma", () => {
    const long = `${"word ".repeat(40)}, and then the rest of it continues on`;
    for (const chunk of speechChunks(long, 100)) expect(chunk.length).toBeLessThanOrEqual(100);
  });

  it("returns nothing for nothing", () => {
    expect(speechChunks("   ")).toEqual([]);
  });
});
