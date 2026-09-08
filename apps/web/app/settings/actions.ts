"use server";

import { revalidatePath } from "next/cache";
import { requireTenant } from "@/lib/guard";
import { provisionWorker, stopWorker } from "@/lib/provision";
import { saveSettings } from "@/lib/settings";

export type ActionState = { ok?: string; error?: string };

export async function saveCredentials(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { tenantId } = await requireTenant();

  const llmKey = String(form.get("llmKey") ?? "").trim();
  const flyToken = String(form.get("flyToken") ?? "").trim();
  const llmModel = String(form.get("llmModel") ?? "").trim();

  if (llmKey && !llmKey.startsWith("sk-or-")) {
    return { error: "That does not look like an OpenRouter key (they start sk-or-)." };
  }

  try {
    await saveSettings(tenantId, {
      ...(llmKey ? { llmKey } : {}),
      ...(flyToken ? { flyToken } : {}),
      ...(llmModel ? { llmModel } : {}),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }

  revalidatePath("/settings");
  return { ok: "Saved." };
}

export async function provision(_previous: ActionState, form: FormData): Promise<ActionState> {
  const { tenantId } = await requireTenant();
  const appName = String(form.get("flyAppName") ?? "").trim();

  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(appName)) {
    return { error: "Enter the Fly app name you created, e.g. zenow-worker-yourname." };
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
