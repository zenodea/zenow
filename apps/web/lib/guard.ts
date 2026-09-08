import { redirect } from "next/navigation";
import { auth } from "./auth/server";

export type Principal = {
  userId: string;
  tenantId: string;
};

/**
 * A user is a tenant. Signing in is all it takes to have a feed -- there is no
 * workspace to create first, and nothing to pick.
 *
 * tenant_id is a uuid either way, so this is a change of meaning rather than a
 * change of schema. Neon Auth's organization plugin is still enabled and its
 * tables are still there, so shared feeds remain possible later without a
 * migration: tenantId would become the organization id for users who have one.
 */
export async function requireTenant(): Promise<Principal> {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect("/auth/sign-in");

  return { userId: session.user.id, tenantId: session.user.id };
}
