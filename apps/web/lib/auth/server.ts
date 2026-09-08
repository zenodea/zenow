import { createNeonAuth } from "@neondatabase/auth/next/server";

/**
 * Neon Auth is a managed Better Auth instance; this object carries all the
 * Better Auth server methods plus handler() and middleware(). The organization
 * plugin is enabled on the Neon side, which is what makes an organization the
 * tenant.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
