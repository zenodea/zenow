import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Header } from "@/components/header";
import { PageTransition } from "@/components/page-transition";
import { getSession } from "@/lib/auth/server";
import { getThemePreference } from "@/lib/theme-server";
import { AppearanceCard } from "./appearance-card";
import { NameForm, PasswordForm, SignOutButton } from "./account-forms";

export const dynamic = "force-dynamic";

const TABS = [
  { path: "settings", label: "Account" },
  { path: "security", label: "Security" },
] as const;

/**
 * Hand-rolled rather than Neon Auth's <AccountView>.
 *
 * That component fetches its own data on the client, so it showed skeleton
 * bars on every visit for values the server already had in the session. Here
 * the name and email are rendered server-side and there is nothing to load;
 * the forms post to the same /api/auth/[...path] handler underneath.
 */
export default async function AccountPage({ params }: { params: Promise<{ path: string }> }) {
  const { data: session } = await getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const { path } = await params;
  if (!TABS.some((tab) => tab.path === path)) notFound();

  // Already read by the root layout on this same request, so this is free.
  const look = await getThemePreference();

  return (
    <>
      <Header />
      <PageTransition>
        <main className="mx-auto max-w-5xl px-6 py-10">
          <h1 className="mb-6 text-xl font-bold tracking-tight">Account</h1>

          <div className="flex flex-col gap-8 sm:flex-row">
            <nav className="flex gap-2 sm:w-40 sm:shrink-0 sm:flex-col sm:gap-1">
              {TABS.map((tab) => (
                <Link
                  key={tab.path}
                  href={`/account/${tab.path}`}
                  className={`rounded-lg px-3 py-1.5 text-sm transition ${
                    tab.path === path ? "bg-line font-medium text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>

            <div className="min-w-0 flex-1 space-y-5">
              {path === "settings" ? (
                <>
                  <NameForm name={session.user.name ?? ""} />
                  <section className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold">Email</h2>
                    <p className="mt-1 text-sm text-muted">
                      You sign in as{" "}
                      <span className="font-medium text-ink">{session.user.email}</span>.
                    </p>
                  </section>

                  <section className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold">Customisation</h2>
                    <p className="mt-1 mb-5 text-sm text-muted">
                      How Zenow looks while you read. Saved to your account, so it follows you to
                      every browser you sign in from.
                    </p>
                    <AppearanceCard saved={look} />
                  </section>
                </>
              ) : (
                <>
                  <PasswordForm />
                  <section className="rounded-xl border border-line bg-surface p-5">
                    <h2 className="text-base font-semibold">Sessions</h2>
                    <p className="mt-1 mb-4 text-sm text-muted">
                      Signing out ends this session on this device.
                    </p>
                    <SignOutButton />
                  </section>
                </>
              )}
            </div>
          </div>
        </main>
      </PageTransition>
    </>
  );
}
