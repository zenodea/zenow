import { z } from "zod";
import { archiveRequestSchema } from "@zenow/shared";
import { authenticate, badRequest, notFound, unauthorized } from "@/lib/auth";
import { setArchived } from "@/lib/items";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const principal = await authenticate(request);
  if (!principal) return unauthorized();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return badRequest("Not a valid item id");

  const parsed = archiveRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Send { archived: boolean }");

  const found = await setArchived(principal.tenantId, id, parsed.data.archived);
  return found ? new Response(null, { status: 204 }) : notFound();
}
