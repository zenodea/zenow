import { env } from "@/lib/env";
import { badRequest } from "@/lib/auth";
import { verifyPassphrase } from "@/lib/passphrase";
import { getSession } from "@/lib/session";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { passphrase?: unknown } | null;
  if (typeof body?.passphrase !== "string") return badRequest("Passphrase required");

  if (!(await verifyPassphrase(body.passphrase, env.loginPassphraseHash))) {
    return Response.json({ error: "Wrong passphrase" }, { status: 401 });
  }

  const session = await getSession();
  session.loggedIn = true;
  await session.save();
  return Response.json({ ok: true });
}
