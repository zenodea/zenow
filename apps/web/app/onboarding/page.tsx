import { redirect } from "next/navigation";
import { OrganizationSwitcher, OrganizationsCard } from "@neondatabase/auth/react/ui";
import { auth } from "@/lib/auth/server";
import { organizationsFor } from "@/lib/organizations";

/**
 * A signed-in user with no workspace has nothing to show. One membership is
 * enough to get going; several means they have to say which.
 */
export default async function OnboardingPage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");
  if (session.session.activeOrganizationId) redirect("/");

  const memberships = await organizationsFor(session.user.id);
  if (memberships.length === 1) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">
        Zenow<span className="text-accent">.</span>
      </h1>
      <p className="mb-8 text-sm text-muted">
        {memberships.length === 0
          ? "Everything you save belongs to a workspace. Create one to get started."
          : "Pick the workspace you want to work in."}
      </p>

      {memberships.length > 1 ? (
        <div className="mb-6">
          <OrganizationSwitcher />
        </div>
      ) : null}

      <OrganizationsCard />
    </main>
  );
}
