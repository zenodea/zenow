import { workerFailureSchema } from "@zenow/shared";
import { failJob } from "@/lib/worker-queue";
import { tenantForWorker } from "@/lib/worker-auth";

export async function POST(request: Request) {
  const tenantId = await tenantForWorker(request);
  if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = workerFailureSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad failure report" }, { status: 400 });

  const ok = await failJob(tenantId, parsed.data);
  return ok ? Response.json({ ok: true }) : Response.json({ error: "Unknown job" }, { status: 404 });
}
