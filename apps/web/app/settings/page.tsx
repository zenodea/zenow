import { OrganizationMembersCard, OrganizationSettingsCards } from "@neondatabase/auth/react/ui";
import { Header } from "@/components/header";
import { requireTenant } from "@/lib/guard";
import { getSettings } from "@/lib/settings";
import { CredentialsForm } from "./credentials-form";
import { WorkerCard } from "./worker-card";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { tenantId } = await requireTenant();
  const settings = await getSettings(tenantId);

  return (
    <>
      <Header narrow />
      <main className="mx-auto max-w-2xl space-y-12 px-6 py-10">
        <section>
          <h1 className="mb-1 text-xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted">
            Workspace <code className="rounded bg-surface px-1 py-0.5 text-[11px]">{tenantId}</code>
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold">Your keys</h2>
          <p className="mb-5 text-sm text-muted">
            Stored encrypted. They are never sent back to the browser once saved — only the last few
            characters, so you can tell which key is in use.
          </p>
          <CredentialsForm settings={settings} />
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold">Worker</h2>
          <p className="mb-4 text-sm text-muted">
            Fetching and summarising runs on your own Fly account, so the compute and the model
            spend are yours.
          </p>
          <WorkerCard settings={settings} />
        </section>

        <section className="space-y-4">
          <h2 className="text-base font-semibold">Workspace</h2>
          <OrganizationSettingsCards />
          <OrganizationMembersCard />
        </section>
      </main>
    </>
  );
}
