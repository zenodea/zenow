import { redirect } from "next/navigation";
import { auth } from "./auth/server";
import { organizationsFor } from "./organizations";

export type Principal = {
  userId: string;
  tenantId: string;
};

/**
 * Everything in Zenow belongs to a workspace, so every page resolves one
 * before it renders.
 *
 * A freshly created organization does not become the session's active one, and
 * a new sign-in starts with none. Cookies cannot be written while rendering, so
 * instead of calling setActive here the tenant falls back to membership, which
 * is unambiguous whenever the user belongs to exactly one workspace. Switching
 * between several is the OrganizationSwitcher's job, and it can set cookies.
 */
export async function requireTenant(): Promise<Principal> {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  const active = session.session.activeOrganizationId;
  if (active) return { userId: session.user.id, tenantId: active };

  const memberships = await organizationsFor(session.user.id);
  const only = memberships.length === 1 ? memberships[0] : undefined;
  if (only) return { userId: session.user.id, tenantId: only.id };

  redirect("/onboarding");
}
