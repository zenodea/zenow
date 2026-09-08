import { z } from "zod";
import { authenticate, badRequest, notFound, unauthorized } from "@/lib/auth";
import { retryItem } from "@/lib/items";
import { kickWorker } from "@/lib/worker";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const principal = await authenticate(request);
  if (!principal) return unauthorized();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return badRequest("Not a valid item id");

  const item = await retryItem(principal.tenantId, id);
  if (!item) return notFound();

  await kickWorker();
  return Response.json({ id: item.id, status: item.status, created: false });
}
