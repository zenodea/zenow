import { claimForTenant } from "@/lib/worker-queue";
import { tenantForWorker } from "@/lib/worker-auth";

export async function POST(request: Request) {
  const tenantId = await tenantForWorker(request);
  if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  return Response.json({ job: await claimForTenant(tenantId) });
}
