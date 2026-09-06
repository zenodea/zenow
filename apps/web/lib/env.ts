/** Lazy so a missing variable fails the request that needs it, not the build. */
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get loginPassphraseHash() {
    return required("LOGIN_PASSPHRASE_HASH");
  },
  get workerUrl() {
    return process.env.WORKER_URL || undefined;
  },
  get workerSecret() {
    return process.env.WORKER_SECRET || undefined;
  },
};
