import type { ImageRef } from "@reader/shared";

export type RawImage = { url: string; alt?: string; width?: number; height?: number };

const TRACKING_HINTS = [
  /pixel/i,
  /beacon/i,
  /\btrack(ing)?\b/i,
  /analytics/i,
  /doubleclick/i,
  /scorecardresearch/i,
  /\/1x1[._]/i,
  /\bspacer\b/i,
];
const SKIP_EXTENSIONS = [".svg", ".ico", ".gif"];
const MIN_DIMENSION = 200;

export function absoluteUrl(src: string | null | undefined, base: URL): string | null {
  const trimmed = src?.trim();
  if (!trimmed || trimmed.startsWith("data:")) return null;
  try {
    const url = new URL(trimmed, base);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

/** `a.jpg 300w, b.jpg 900w` -> the widest candidate. */
export function largestFromSrcset(srcset: string): string | null {
  let best: string | null = null;
  let bestScore = -1;
  for (const part of srcset.split(",")) {
    const [candidate, descriptor] = part.trim().split(/\s+/);
    if (!candidate) continue;
    const score = descriptor ? Number.parseFloat(descriptor) || 0 : 0;
    if (score >= bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  return best;
}

/** Logos, avatars, spacers and tracking pixels are never worth showing. */
export function isLikelyContentImage(url: string, width?: number, height?: number): boolean {
  if (TRACKING_HINTS.some((hint) => hint.test(url))) return false;
  if (width !== undefined && width < MIN_DIMENSION) return false;
  if (height !== undefined && height < MIN_DIMENSION) return false;

  try {
    const path = new URL(url).pathname.toLowerCase();
    if (SKIP_EXTENSIONS.some((ext) => path.endsWith(ext))) return false;
  } catch {
    return false;
  }
  return true;
}

function positiveInt(value: string | null | undefined): number | undefined {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Pulls candidate images out of already-cleaned markup. */
export function imagesFromElement(root: ParentNode, base: URL): RawImage[] {
  const out: RawImage[] = [];

  for (const img of root.querySelectorAll("img")) {
    const srcset = img.getAttribute("srcset") ?? img.getAttribute("data-srcset");
    const candidate =
      img.getAttribute("src") ??
      img.getAttribute("data-src") ??
      img.getAttribute("data-original") ??
      (srcset ? largestFromSrcset(srcset) : null);

    const url = absoluteUrl(candidate, base);
    if (!url) continue;

    const width = positiveInt(img.getAttribute("width"));
    const height = positiveInt(img.getAttribute("height"));
    if (!isLikelyContentImage(url, width, height)) continue;

    const caption = img.closest("figure")?.querySelector("figcaption")?.textContent?.trim();
    const alt = img.getAttribute("alt")?.trim() || caption || undefined;

    out.push({ url, ...(alt ? { alt } : {}), ...(width ? { width } : {}), ...(height ? { height } : {}) });
  }

  return out;
}

/** Dedupes by url and assigns the indices the summarizer refers back to. */
export function indexImages(raw: RawImage[], limit = 20): ImageRef[] {
  const seen = new Set<string>();
  const out: ImageRef[] = [];
  for (const image of raw) {
    if (seen.has(image.url)) continue;
    seen.add(image.url);
    out.push({ index: out.length, ...image });
    if (out.length >= limit) break;
  }
  return out;
}
