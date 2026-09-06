import { z } from "zod";
import { authenticate, badRequest, notFound, unauthorized } from "@/lib/auth";
import { deleteItem, getItemDetail } from "@/lib/items";

type Context = { params: Promise<{ id: string }> };

const idSchema = z.uuid();

export async function GET(request: Request, { params }: Context) {
  if (!(await authenticate(request))) return unauthorized();

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return badRequest("Not a valid item id");

  const item = await getItemDetail(id);
  return item ? Response.json(item) : notFound();
}

export async function DELETE(request: Request, { params }: Context) {
  if (!(await authenticate(request))) return unauthorized();

  const { id } = await params;
  if (!idSchema.safeParse(id).success) return badRequest("Not a valid item id");

  return (await deleteItem(id)) ? new Response(null, { status: 204 }) : notFound();
}
