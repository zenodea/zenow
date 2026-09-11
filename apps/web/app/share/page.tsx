import Link from "next/link";
import { redirect } from "next/navigation";
import { Header } from "@/components/header";
import { requireTenant } from "@/lib/guard";
import { saveItem } from "@/lib/items";

export const dynamic = "force-dynamic";

/**
 * Where the system share sheet lands. Android sends a shared link as `url`,
 * but plenty of apps share a link inside `text` instead, so both are searched.
 */
function linkIn(params: Record<string, string | string[] | undefined>): string | null {
  for (const key of ["url", "text", "title"]) {
    const value = params[key];
    const candidate = Array.isArray(value) ? value[0] : value;
    const match = candidate?.match(/https?:\/\/\S+/);
    if (match) return match[0];
  }
  return null;
}

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { tenantId } = await requireTenant();
  const url = linkIn(await searchParams);

  if (url) {
    const { item } = await saveItem(tenantId, { url, savedFrom: "web" });
    redirect(`/items/${item.id}`);
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-5xl px-6 py-24 text-center">
        <p className="mb-4 text-sm text-muted">There was no link in what was shared.</p>
        <Link href="/" className="text-sm text-accent underline">
          Back to your list
        </Link>
      </main>
    </>
  );
}
