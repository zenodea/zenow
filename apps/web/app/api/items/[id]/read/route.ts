import { z } from "zod";
import { authenticate, badRequest, unauthorized } from "@/lib/auth";
import { markRead } from "@/lib/items";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  const principal = await authenticate(request);
  if (!principal) return unauthorized();

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return badRequest("Not a valid item id");

  await markRead(principal.tenantId, id);
  return new Response(null, { status: 204 });
}
