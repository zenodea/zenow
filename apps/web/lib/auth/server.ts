import { createNeonAuth } from "@neondatabase/auth/next/server";
import { cache } from "react";

/**
 * Neon Auth is a managed Better Auth instance; this object carries all the
 * Better Auth server methods plus handler() and middleware(). The organization
 * plugin is enabled on the Neon side, which is what makes an organization the
 * tenant.
 */
export const auth = createNeonAuth({
  baseUrl: process.env.NEON_AUTH_BASE_URL!,
  cookies: {
    secret: process.env.NEON_AUTH_COOKIE_SECRET!,
    // Keeps session data in the cookie for five minutes, so most requests
    // answer getSession() without a network call at all.
    sessionDataTtl: 300,
  },
});

/**
 * Deduplicated per request. The header and the page guard both need the
 * session, and without this each one made its own round trip to Neon Auth --
 * which, with functions in one region and Neon in another, is a transatlantic
 * hop each.
 */
export const getSession = cache(() => auth.getSession());
