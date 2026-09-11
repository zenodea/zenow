function optional(name: string): string {
  return process.env[name] ?? "";
}

/**
 * Two shapes of worker share this binary.
 *
 * remote: runs on a tenant's own Fly account. It talks to the Zenow API over
 * http and holds no database credential -- only its own worker token and its
 * own OpenRouter key.
 *
 * local: the shared worker. It drains every tenant's jobs straight from
 * Postgres and decrypts each tenant's key per job, so it needs CREDENTIALS_KEY.
 */
export const env = {
  apiUrl: optional("ZENOW_API_URL").replace(/\/+$/, ""),
  workerToken: optional("ZENOW_WORKER_TOKEN"),

  databaseUrl: optional("DATABASE_URL_UNPOOLED") || optional("DATABASE_URL"),
  workerSecret: optional("WORKER_SECRET"),

  port: Number(process.env.PORT ?? 8080),
  concurrency: Number(process.env.CONCURRENCY ?? 3),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 30_000),
  staleLockMinutes: Number(process.env.STALE_LOCK_MINUTES ?? 10),

  openrouterApiKey: optional("OPENROUTER_API_KEY"),
  model: process.env.LLM_MODEL ?? "openai/gpt-5.6-luna",

  redditClientId: optional("REDDIT_CLIENT_ID"),
  redditClientSecret: optional("REDDIT_CLIENT_SECRET"),

  /** Netscape cookies.txt contents. Without it YouTube refuses cloud IPs. */
  youtubeCookies: optional("YOUTUBE_COOKIES"),

  get mode(): "remote" | "local" {
    return this.apiUrl && this.workerToken ? "remote" : "local";
  },
};

export function assertConfigured(): void {
  if (env.mode === "remote") {
    if (!env.openrouterApiKey) {
      throw new Error("A remote worker needs OPENROUTER_API_KEY; it cannot read the tenant's stored key.");
    }
    return;
  }
  if (!env.databaseUrl) {
    throw new Error("Set DATABASE_URL_UNPOOLED for a shared worker, or ZENOW_API_URL and ZENOW_WORKER_TOKEN for a tenant worker.");
  }
}
