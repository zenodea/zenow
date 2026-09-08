import { decryptSecret, encryptSecret, eq, hint, tenantSettings, type TenantSettings } from "@zenow/db";
import { db } from "./db";

/** Everything the settings page is allowed to know. No ciphertext leaves here. */
export type SettingsView = {
  llmKeyHint: string | null;
  llmModel: string;
  flyTokenHint: string | null;
  flyAppName: string | null;
  workerStatus: TenantSettings["workerStatus"];
  workerError: string | null;
};

const DEFAULTS: SettingsView = {
  llmKeyHint: null,
  llmModel: "anthropic/claude-haiku-4.5",
  flyTokenHint: null,
  flyAppName: null,
  workerStatus: "none",
  workerError: null,
};

export async function getSettings(tenantId: string): Promise<SettingsView> {
  const [row] = await db().select().from(tenantSettings).where(eq(tenantSettings.tenantId, tenantId)).limit(1);
  if (!row) return DEFAULTS;

  return {
    llmKeyHint: row.llmKeyHint,
    llmModel: row.llmModel,
    flyTokenHint: row.flyTokenHint,
    flyAppName: row.flyAppName,
    workerStatus: row.workerStatus,
    workerError: row.workerError,
  };
}

export type SettingsUpdate = {
  llmKey?: string;
  llmModel?: string;
  flyToken?: string;
  flyAppName?: string;
};

/** A blank field means "leave what is already stored" rather than "clear it". */
export async function saveSettings(tenantId: string, update: SettingsUpdate): Promise<void> {
  const values: typeof tenantSettings.$inferInsert = { tenantId, updatedAt: new Date() };

  if (update.llmKey) {
    values.llmKeyEncrypted = encryptSecret(update.llmKey);
    values.llmKeyHint = hint(update.llmKey);
  }
  if (update.flyToken) {
    values.flyTokenEncrypted = encryptSecret(update.flyToken);
    values.flyTokenHint = hint(update.flyToken);
  }
  if (update.llmModel) values.llmModel = update.llmModel;
  if (update.flyAppName) values.flyAppName = update.flyAppName;

  const { tenantId: _ignored, ...set } = values;
  await db().insert(tenantSettings).values(values).onConflictDoUpdate({
    target: tenantSettings.tenantId,
    set,
  });
}

/** Server-side only: used when running this tenant's jobs. */
export async function getLlmKey(tenantId: string): Promise<{ key: string; model: string } | null> {
  const [row] = await db()
    .select({ encrypted: tenantSettings.llmKeyEncrypted, model: tenantSettings.llmModel })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (!row?.encrypted) return null;
  return { key: decryptSecret(row.encrypted), model: row.model };
}

export async function getFlyToken(tenantId: string): Promise<string | null> {
  const [row] = await db()
    .select({ encrypted: tenantSettings.flyTokenEncrypted })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  return row?.encrypted ? decryptSecret(row.encrypted) : null;
}
