import { authenticate, unauthorized } from "@/lib/auth";
import { listTags } from "@/lib/items";

export async function GET(request: Request) {
  const principal = await authenticate(request);
  if (!principal) return unauthorized();

  return Response.json({ tags: await listTags(principal.tenantId) });
}
