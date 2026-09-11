import { authenticate, unauthorized } from "@/lib/auth";

/** Lets a client check that the credential it holds is still good. */
export async function GET(request: Request) {
  const principal = await authenticate(request);
  if (!principal) return unauthorized();

  return Response.json({
    tenant_id: principal.tenantId,
    connected_as: principal.kind === "token" ? principal.name : "browser session",
  });
}
