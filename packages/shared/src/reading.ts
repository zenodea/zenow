export const readingViews = ["summary", "original"] as const;
export type ReadingView = (typeof readingViews)[number];

export const defaultReadingView: ReadingView = "summary";

export function isReadingView(value: unknown): value is ReadingView {
  return typeof value === "string" && (readingViews as readonly string[]).includes(value);
}
