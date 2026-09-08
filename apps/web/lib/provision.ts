import { randomBytes } from "node:crypto";
import { eq, tenantSettings } from "@zenow/db";
import { db } from "./db";
import { createMachine, destroyMachine, FlyError, listMachines, waitForStarted } from "./fly";
import { getFlyToken, getLlmKey } from "./settings";
import { hashWorkerToken } from "./worker-auth";

const MACHINE_NAME = "zenow-worker";
const MEMORY_MB = 1024;

function config() {
  const image = process.env.WORKER_IMAGE;
  const apiUrl = process.env.PUBLIC_APP_URL;
  if (!image) throw new Error("WORKER_IMAGE is not set on the server");
  if (!apiUrl) throw new Error("PUBLIC_APP_URL is not set on the server");
  return { image, apiUrl, region: process.env.FLY_REGION ?? "lhr" };
}

async function setStatus(
  tenantId: string,
  status: "provisioning" | "running" | "stopped" | "error" | "none",
  fields: Partial<typeof tenantSettings.$inferInsert> = {},
): Promise<void> {
  await db()
    .update(tenantSettings)
    .set({ workerStatus: status, updatedAt: new Date(), ...fields })
    .where(eq(tenantSettings.tenantId, tenantId));
}

/**
 * Creates the worker machine on the tenant's own Fly account.
 *
 * The app must already exist: an app-scoped deploy token -- the only kind
 * worth asking anyone to hand over -- can manage machines inside its app but
 * cannot create the app itself.
 */
export async function provisionWorker(tenantId: string, appName: string): Promise<{ machineId: string }> {
  const { image, apiUrl, region } = config();

  const flyToken = await getFlyToken(tenantId);
  if (!flyToken) throw new Error("Add your Fly deploy token first.");

  const llm = await getLlmKey(tenantId);
  if (!llm) throw new Error("Add your OpenRouter key first: the worker needs it to summarise.");

  // Rotating on every provision means a machine that was destroyed, or a token
  // that leaked with an old machine, stops working the moment this runs.
  const workerToken = randomBytes(32).toString("base64url");

  await db()
    .insert(tenantSettings)
    .values({
      tenantId,
      workerTokenHash: hashWorkerToken(workerToken),
      flyAppName: appName,
      workerStatus: "provisioning",
      workerError: null,
    })
    .onConflictDoUpdate({
      target: tenantSettings.tenantId,
      set: {
        workerTokenHash: hashWorkerToken(workerToken),
        flyAppName: appName,
        workerStatus: "provisioning",
        workerError: null,
        updatedAt: new Date(),
      },
    });

  try {
    // Replace rather than accumulate: one worker per workspace.
    for (const machine of await listMachines(flyToken, appName)) {
      if (machine.name === MACHINE_NAME) await destroyMachine(flyToken, appName, machine.id);
    }

    const machine = await createMachine(flyToken, appName, {
      name: MACHINE_NAME,
      region,
      image,
      memoryMb: MEMORY_MB,
      env: {
        ZENOW_API_URL: apiUrl,
        ZENOW_WORKER_TOKEN: workerToken,
        OPENROUTER_API_KEY: llm.key,
        LLM_MODEL: llm.model,
        PORT: "8080",
      },
    });

    await waitForStarted(flyToken, appName, machine.id).catch(() => {
      // Started is nice to confirm but not worth failing provisioning over.
    });

    await setStatus(tenantId, "running", { flyMachineId: machine.id });
    return { machineId: machine.id };
  } catch (error) {
    const message =
      error instanceof FlyError && error.status === 404
        ? `Fly has no app called "${appName}", or your token cannot see it. Create it with: fly apps create ${appName}`
        : error instanceof Error
          ? error.message
          : "Provisioning failed";

    await setStatus(tenantId, "error", { workerError: message });
    throw new Error(message);
  }
}

export async function stopWorker(tenantId: string): Promise<void> {
  const [row] = await db()
    .select({ app: tenantSettings.flyAppName, machineId: tenantSettings.flyMachineId })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  const flyToken = await getFlyToken(tenantId);
  if (flyToken && row?.app && row.machineId) {
    await destroyMachine(flyToken, row.app, row.machineId).catch(() => {
      // Already gone is the desired end state either way.
    });
  }

  // The token dies with the machine, so a stale copy cannot claim work.
  await setStatus(tenantId, "stopped", { flyMachineId: null, workerTokenHash: null });
}
