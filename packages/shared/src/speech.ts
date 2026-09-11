/**
 * Text for a speech synthesiser. Markdown is written to be looked at, so the
 * punctuation that carries structure on a page ("**", "##", "1.") is noise
 * when spoken, and links read as their label rather than their url.
 */
export function markdownToSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    // \s would eat the blank line that separates two blocks, running them
    // together into one breathless sentence.
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, "")
    .replace(/^[ \t]{0,3}>[ \t]?/gm, "")
    // A bullet is a sentence of its own, so it ends like one.
    .replace(/^[ \t]{0,3}(?:[-*+]|\d+\.)[ \t]+(.*)$/gm, (_, line: string) =>
      /[.!?:;,]$/.test(line.trim()) ? line : `${line}.`,
    )
    .replace(/(\*\*|__|\*|_|~~)/g, "")
    .replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, " ")
    .replace(/\s*\n\s*\n\s*/g, ". ")
    .replace(/\s+/g, " ")
    .replace(/\.\s*\.\s*/g, ". ")
    .trim();
}

const SENTENCE_END = /(?<=[.!?])\s+(?=[A-Z0-9"'(])/;

/**
 * Splits into utterances a synthesiser will finish. Long text handed over in
 * one piece gets cut off mid-word by some engines, and a queue of sentences is
 * also what makes pausing land somewhere sensible.
 */
export function speechChunks(text: string, maxChars = 240): string[] {
  const chunks: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) chunks.push(trimmed);
    current = "";
  };

  for (const sentence of text.split(SENTENCE_END)) {
    if (sentence.length > maxChars) {
      push();
      // A sentence longer than the budget breaks at commas, then by force.
      let rest = sentence;
      while (rest.length > maxChars) {
        const window = rest.slice(0, maxChars);
        const cut = Math.max(window.lastIndexOf(", "), window.lastIndexOf("; "), window.lastIndexOf(" "));
        const at = cut > maxChars / 2 ? cut + 1 : maxChars;
        chunks.push(rest.slice(0, at).trim());
        rest = rest.slice(at);
      }
      current = rest;
      continue;
    }

    if (current && current.length + sentence.length + 1 > maxChars) push();
    current = current ? `${current} ${sentence}` : sentence;
  }

  push();
  return chunks;
}
