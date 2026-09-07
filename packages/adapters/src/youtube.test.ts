import { describe, expect, it } from "vitest";
import { vttToText } from "./youtube.js";

describe("vttToText", () => {
  it("strips timings, cue numbers and inline tags", () => {
    const vtt = `WEBVTT
Kind: captions
Language: en

1
00:00:01.000 --> 00:00:04.000
<c>Hello</c> and welcome to the show

2
00:00:04.000 --> 00:00:07.000
today we are talking about databases`;

    expect(vttToText(vtt)).toBe("Hello and welcome to the show today we are talking about databases");
  });

  it("collapses the rolling window auto-captions produce", () => {
    // Each cue repeats the tail of the previous one and extends it.
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
so the thing about

00:00:02.000 --> 00:00:04.000
so the thing about latency is

00:00:04.000 --> 00:00:06.000
that it compounds`;

    expect(vttToText(vtt)).toBe("so the thing about latency is that it compounds");
  });

  it("drops exact repeats", () => {
    const vtt = `WEBVTT

00:00:00.000 --> 00:00:02.000
same line

00:00:02.000 --> 00:00:04.000
same line`;

    expect(vttToText(vtt)).toBe("same line");
  });

  it("returns nothing for a caption file with no cues", () => {
    expect(vttToText("WEBVTT\n\n")).toBe("");
  });
});
