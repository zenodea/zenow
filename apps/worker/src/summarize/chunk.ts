/** Rough, but only used to decide whether one pass will fit. */
export const CHARS_PER_TOKEN = 4;
export const SINGLE_PASS_CHARS = 60_000 * CHARS_PER_TOKEN;
export const CHUNK_CHARS = 40_000 * CHARS_PER_TOKEN;

/**
 * Splits on paragraph boundaries so a chunk never starts mid-sentence. A
 * paragraph longer than the budget is hard-split, after flushing whatever was
 * already buffered, so the pieces stay in order.
 */
export function splitIntoChunks(text: string, maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of text.split(/\n{2,}/)) {
    if (paragraph.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < paragraph.length; i += maxChars) {
        chunks.push(paragraph.slice(i, i + maxChars));
      }
      continue;
    }

    if (current && current.length + paragraph.length + 2 > maxChars) {
      chunks.push(current);
      current = paragraph;
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}
