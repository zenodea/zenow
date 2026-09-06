import { InvalidUrlError, listItemsQuerySchema, saveItemRequestSchema } from "@reader/shared";
import { authenticate, badRequest, unauthorized } from "@/lib/auth";
import { listItems, saveItem } from "@/lib/items";
import { kickWorker } from "@/lib/worker";

export async function POST(request: Request) {
  if (!(await authenticate(request))) return unauthorized();

  const parsed = saveItemRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return badRequest("Send a JSON body of the form {\"url\": \"...\"}");

  try {
    const { item, created } = await saveItem({ url: parsed.data.url, savedFrom: parsed.data.saved_from });
    if (created) await kickWorker();
    return Response.json({ id: item.id, status: item.status, created }, { status: created ? 201 : 200 });
  } catch (error) {
    if (error instanceof InvalidUrlError) return badRequest(error.message);
    throw error;
  }
}

export async function GET(request: Request) {
  if (!(await authenticate(request))) return unauthorized();

  const parsed = listItemsQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return badRequest("Unrecognised query parameters");

  return Response.json(await listItems(parsed.data));
}
