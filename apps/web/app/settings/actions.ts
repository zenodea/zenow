"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/guard";
import { looksLikeFlyToken, normalizeFlyToken, verifyToken } from "@/lib/fly";
import { provisionWorker, stopWorker } from "@/lib/provision";
import { getSettings, saveSettings } from "@/lib/settings";
import { createToken, revokeToken } from "@/lib/tokens";

export type ActionState = { ok?: string; error?: string };

export async function saveCredentials(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { tenantId } = await requireTenant();

  const llmKey = String(form.get("llmKey") ?? "").trim();
  const llmModel = String(form.get("llmModel") ?? "").trim();
  const flyToken = normalizeFlyToken(String(form.get("flyToken") ?? ""));
  const flyAppName = String(form.get("flyAppName") ?? "").trim();

  if (llmKey && !llmKey.startsWith("sk-or-")) {
    return { error: "That does not look like an OpenRouter key (they start sk-or-)." };
  }

  let createdApp = false;

  if (flyAppName && !/^[a-z0-9][a-z0-9-]{1,62}$/.test(flyAppName)) {
    return { error: "A Fly app name is lowercase letters, digits and dashes." };
  }

  // Checked here rather than at provision time: finding out a token is wrong
  // while pasting it is far better than finding out later from a 401. It can
  // only be checked against the app it is scoped to, so both are needed.
  if (flyToken) {
    if (!looksLikeFlyToken(flyToken)) {
      return { error: "That does not look like a Fly token. They contain 'fm2_' and are usually prefixed 'FlyV1 '." };
    }
    if (!flyAppName) {
      return { error: "Enter the Fly app name too — a deploy token can only be checked against its own app." };
    }
    const check = await verifyToken(flyToken, flyAppName);
    if (!check.ok) return { error: check.reason };
    createdApp = check.created;
  }

  try {
    await saveSettings(tenantId, {
      ...(llmKey ? { llmKey } : {}),
      ...(flyToken ? { flyToken } : {}),
      ...(llmModel ? { llmModel } : {}),
      ...(flyAppName ? { flyAppName } : {}),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }

  revalidatePath("/settings");
  return { ok: createdApp ? `Saved, and created the Fly app "${flyAppName}".` : "Saved." };
}

// The app name comes from what was saved, not the form, so the token it was
// verified against is the one it will be used with.
export async function provision(_previous: ActionState, _form: FormData): Promise<ActionState> {
  const { tenantId } = await requireTenant();
  const { flyAppName: appName } = await getSettings(tenantId);

  if (!appName) {
    return { error: "Save your Fly app name and token first." };
  }

  try {
    const { machineId } = await provisionWorker(tenantId, appName);
    revalidatePath("/settings");
    return { ok: `Worker running (machine ${machineId}).` };
  } catch (error) {
    revalidatePath("/settings");
    return { error: error instanceof Error ? error.message : "Provisioning failed" };
  }
}

export async function stop(): Promise<void> {
  const { tenantId } = await requireTenant();
  await stopWorker(tenantId);
  revalidatePath("/settings");
}

export type TokenActionState = ActionState & { raw?: string; name?: string };

/**
 * The raw token is returned to the caller once and never stored, so this is
 * the only moment it can be shown. It rides back in the action state rather
 * than the page, which means a reload cannot resurrect it.
 */
export async function mintToken(
  _previous: TokenActionState,
  form: FormData,
): Promise<TokenActionState> {
  const { tenantId } = await requireTenant();
  const name = String(form.get("name") ?? "").trim() || "firefox";

  if (name.length > 40) {
    return { error: "Keep the name under 40 characters." };
  }

  try {
    const { raw, token } = await createToken(tenantId, name);
    revalidatePath("/settings");
    return { ok: `Token "${token.name}" created.`, raw, name: token.name };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not create the token" };
  }
}

export async function revoke(form: FormData): Promise<void> {
  const { tenantId } = await requireTenant();
  const id = String(form.get("id") ?? "");

  if (id) await revokeToken(tenantId, id);
  revalidatePath("/settings");
}
