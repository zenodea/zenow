import { eq, tenantSettings } from "@zenow/db";
import { cache } from "react";
import { getSession } from "./auth/server";
import { db } from "./db";
import { defaultTheme, defaultThemeMode, type Theme, type ThemeMode } from "@zenow/shared";

export type ThemePreference = { theme: Theme; mode: ThemeMode };

const DEFAULTS: ThemePreference = { theme: defaultTheme, mode: defaultThemeMode };

/**
 * Read by the root layout, so it runs on every page including the signed-out
 * ones. It never throws: a reader with no session, or a database that is
 * having a bad minute, gets the default look rather than an error page. The
 * theme is not worth failing a request over.
 *
 * Deduplicated per request, since generateViewport asks for it as well.
 */
export const getThemePreference = cache(async (): Promise<ThemePreference> => {
  try {
    const { data: session } = await getSession();
    if (!session?.user) return DEFAULTS;

    const [row] = await db()
      .select({ theme: tenantSettings.theme, mode: tenantSettings.themeMode })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, session.user.id))
      .limit(1);

    return row ? { theme: row.theme, mode: row.mode } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
});
