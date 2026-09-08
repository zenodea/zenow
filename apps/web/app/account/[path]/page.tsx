import { AccountView } from "@neondatabase/auth/react/ui";
import { notFound } from "next/navigation";
import { Header } from "@/components/header";
import { requireTenant } from "@/lib/guard";

/**
 * Where the UserButton sends people: profile, password, sessions, connected
 * accounts. Neon Auth also defines teams, api-keys and organizations views,
 * which this app has no use for, so they are not routed.
 */
const PATHS = new Set(["settings", "security"]);

export default async function AccountPage({ params }: { params: Promise<{ path: string }> }) {
  await requireTenant();

  const { path } = await params;
  if (!PATHS.has(path)) notFound();

  return (
    <>
      <Header narrow />
      <main className="mx-auto max-w-2xl px-6 py-10">
        <h1 className="mb-6 text-xl font-bold tracking-tight">Account</h1>
        <AccountView path={path} />
      </main>
    </>
  );
}
