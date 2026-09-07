const MAX_TAGS = 3;
const MAX_TAG_LENGTH = 32;

/**
 * Models will happily emit "Machine Learning", "machine_learning" and "ML" for
 * the same idea across three articles. Everything collapses to kebab-case so
 * the filter actually groups things.
 */
export function normalizeTag(raw: string): string | null {
  const tag = raw
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[\s_/]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "");

  if (!tag || tag.length > MAX_TAG_LENGTH) return null;
  return tag;
}

export function normalizeTags(raw: string[], limit = MAX_TAGS): string[] {
  const seen = new Set<string>();
  for (const candidate of raw) {
    const tag = normalizeTag(candidate);
    if (tag) seen.add(tag);
    if (seen.size >= limit) break;
  }
  return [...seen];
}
