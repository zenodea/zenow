import type { ImageRef, SourceType } from "@reader/shared";

export const SYSTEM_PROMPT = `You summarize saved web content for one reader who wants the substance fast.

summary_md is 120-250 words of markdown prose. No headings, no preamble, no
"this article discusses".
key_points is 3-6 bullets, each a single sentence carrying an actual claim or
fact rather than a topic label.
title is the clean title with any site-name or section suffix removed.
read_time_min is how long the original takes to read, not the summary.
image_picks names 0-3 images worth showing: charts, diagrams, screenshots,
product shots, photographs of the subject. Never logos, avatars, banners or
decoration. Refer to images by the index given in the image list, and write a
caption saying what the image shows.

Source-specific:
- reddit: the top comments are part of the content. Say where they add to or
  disagree with the post.
- youtube with a transcript: summarize what is said, not the description.
- youtube without a transcript: say so in the first sentence and work from the
  description alone.
- article: if the text looks truncated by a paywall, say so rather than
  pretending the summary is complete.`;

function formatMeta(meta: Record<string, unknown>): string {
  const interesting = ["author", "byline", "published_at", "site_name", "subreddit", "score", "num_comments", "channel", "duration", "has_transcript"];
  return interesting
    .flatMap((key) => {
      const value = meta[key];
      return value === undefined || value === null || value === "" ? [] : [`${key}: ${String(value)}`];
    })
    .join("\n");
}

function formatImages(images: ImageRef[]): string {
  if (images.length === 0) return "No images.";
  return images
    .map((image) => `${image.index}: ${image.url}${image.alt ? ` — ${image.alt}` : ""}`)
    .join("\n");
}

export function buildUserMessage(input: {
  sourceType: SourceType;
  title: string | null;
  url: string;
  text: string;
  images: ImageRef[];
  meta: Record<string, unknown>;
}): string {
  const meta = formatMeta(input.meta);

  return [
    `Source type: ${input.sourceType}`,
    `URL: ${input.url}`,
    input.title ? `Title as saved: ${input.title}` : "",
    meta,
    "",
    "Images:",
    formatImages(input.images),
    "",
    "Content:",
    input.text,
  ]
    .filter((section) => section !== "")
    .join("\n");
}
