import { workerFetchResultSchema, workerSummarizeResultSchema } from "@zenow/shared";
import { completeFetch, completeSummarize } from "@/lib/worker-queue";
import { tenantForWorker } from "@/lib/worker-auth";

export async function POST(request: Request) {
  const tenantId = await tenantForWorker(request);
  if (!tenantId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);

  const fetched = workerFetchResultSchema.safeParse(body);
  if (fetched.success) {
    const ok = await completeFetch(tenantId, fetched.data);
    return ok ? Response.json({ ok: true }) : Response.json({ error: "Unknown job" }, { status: 404 });
  }

  const summarized = workerSummarizeResultSchema.safeParse(body);
  if (summarized.success) {
    const ok = await completeSummarize(tenantId, summarized.data);
    return ok ? Response.json({ ok: true }) : Response.json({ error: "Unknown job" }, { status: 404 });
  }

  return Response.json({ error: "Body matches neither a fetch nor a summarize result" }, { status: 400 });
}
