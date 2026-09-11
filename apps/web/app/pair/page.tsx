import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { requireTenant } from "@/lib/guard";
import { createToken } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * Where the phone app sends you to sign in. The token is handed back through
 * a deep link into the app, and the scheme is fixed here rather than taken
 * from the query: a redirect target the caller chooses is a way to post
 * someone's credential to an address of your choosing.
 */
const CALLBACK = "zenow://auth";

const NAME_LIMIT = 40;

async function connect(form: FormData): Promise<void> {
  "use server";

  const { tenantId } = await requireTenant();
  const name = String(form.get("name") ?? "").trim().slice(0, NAME_LIMIT) || "phone";
  const { raw } = await createToken(tenantId, name);

  redirect(`${CALLBACK}?token=${encodeURIComponent(raw)}&name=${encodeURIComponent(name)}`);
}

export default async function PairPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // requireTenant sends you to sign in first, which is the whole point of
  // pairing in a browser rather than asking for a password in the app.
  await requireTenant();

  const device = (await searchParams).device;
  const suggested = (Array.isArray(device) ? device[0] : device)?.slice(0, NAME_LIMIT) ?? "phone";

  return (
    <>
      <Header />
      <main className="mx-auto max-w-md px-6 py-16">
        <h1 className="mb-2 text-xl font-bold tracking-tight">Connect this device</h1>
        <p className="mb-8 text-sm text-muted">
          Zenow will open again with a token for this device only. Revoke it any time under
          Settings → Extension tokens, and nothing else stops working.
        </p>

        <form action={connect} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={suggested}
              maxLength={NAME_LIMIT}
              autoComplete="off"
              className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Connect
          </button>
        </form>
      </main>
    </>
  );
}
