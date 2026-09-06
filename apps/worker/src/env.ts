function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

/** Direct (non-pooler) url preferred: the claim query wants prepared statements. */
export const env = {
  databaseUrl: required("DATABASE_URL_UNPOOLED", process.env.DATABASE_URL),
  workerSecret: process.env.WORKER_SECRET ?? "",
  port: Number(process.env.PORT ?? 8080),
  concurrency: Number(process.env.CONCURRENCY ?? 3),
  pollIntervalMs: Number(process.env.POLL_INTERVAL_MS ?? 30_000),
  staleLockMinutes: Number(process.env.STALE_LOCK_MINUTES ?? 10),

  openrouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  model: process.env.LLM_MODEL ?? "anthropic/claude-haiku-4.5",
};
