import { researchRequestSchema } from "@zenow/shared";
import { authenticate, badRequest, unauthorized } from "@/lib/auth";
import { startResearch } from "@/lib/items";
import { kickWorker } from "@/lib/worker";

export async function POST(request: Request) {
  const principal = await authenticate(request);
  if (!principal) return unauthorized();

  const parsed = researchRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return badRequest("Ask a question of at least ten characters.");
  }

  const item = await startResearch(principal.tenantId, parsed.data.prompt);
  await kickWorker(principal.tenantId);

  return Response.json({ id: item.id, status: item.status, created: true }, { status: 201 });
}
