const DEFAULT_INTERVAL_MS = 2000;
const PER_HOST_INTERVAL_MS: Record<string, number> = {
  "reddit.com": 2000,
  "oauth.reddit.com": 2000,
  "www.reddit.com": 2000,
  "youtube.com": 3000,
  "www.youtube.com": 3000,
};

/** Next free slot per host, so concurrent jobs queue rather than collide. */
const nextSlot = new Map<string, number>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForHost(host: string): Promise<void> {
  const interval = PER_HOST_INTERVAL_MS[host] ?? DEFAULT_INTERVAL_MS;
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? 0);

  nextSlot.set(host, slot + interval);
  if (slot > now) await sleep(slot - now);
}

export function resetRateLimiter(): void {
  nextSlot.clear();
}
