import { decryptSecret, eq, tenantSettings, type Database } from "@zenow/db";
import { env } from "../env.js";
import { SummarizerError, type LlmCredentials } from "../summarize/index.js";

/**
 * Each workspace pays for its own summaries. A worker running on a tenant's own
 * Fly account carries their key in its environment; the shared worker looks it
 * up and decrypts it per job.
 */
export async function credentialsFor(db: Database, tenantId: string): Promise<LlmCredentials> {
  if (env.openrouterApiKey) return { apiKey: env.openrouterApiKey, model: env.model };

  const [row] = await db
    .select({ encrypted: tenantSettings.llmKeyEncrypted, model: tenantSettings.llmModel })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!row?.encrypted) {
    throw new SummarizerError("No OpenRouter key set for this workspace. Add one in Settings.", false);
  }
  return { apiKey: decryptSecret(row.encrypted), model: row.model };
}
