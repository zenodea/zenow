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
          <p className="text-sm text-muted">Your feed is yours alone. Nobody else can see it.</p>
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
          <h2 className="mb-1 text-base font-semibold">Your worker</h2>
          <p className="mb-4 text-sm text-muted">
            Optional. Fetching and summarising runs on your own Fly account, so the compute is yours
            and nothing of yours queues behind anyone else.
          </p>
          <WorkerCard settings={settings} />
        </section>
      </main>
    </>
  );
}
