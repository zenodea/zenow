"use server";

import { revalidatePath } from "next/cache";
import { isReadingView, isTheme, isThemeMode } from "@zenow/shared";
import { requireTenant } from "@/lib/guard";
import { saveSettings } from "@/lib/settings";

export type AppearanceState = { ok?: string; error?: string };

/**
 * Saved on its own, without the rest of the settings form: the picker applies
 * the change to the page as you click it, so this only has to make it stick.
 * The layout reads it back on the next full load, and every other device on
 * their next.
 */
export async function saveAppearance(
  _previous: AppearanceState,
  form: FormData,
): Promise<AppearanceState> {
  const { tenantId } = await requireTenant();

  const theme = form.get("theme");
  const themeMode = form.get("themeMode");

  if (!isTheme(theme) || !isThemeMode(themeMode)) {
    return { error: "That is not a theme Zenow knows." };
  }

  try {
    await saveSettings(tenantId, { theme, themeMode });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }

  // The look lives on <html> in the root layout, so every page carries it.
  revalidatePath("/", "layout");
  return { ok: "Saved." };
}

export type ReadingState = { error?: string };

export async function saveReadingView(_previous: ReadingState, form: FormData): Promise<ReadingState> {
  const { tenantId } = await requireTenant();

  const readingView = form.get("readingView");
  if (!isReadingView(readingView)) return { error: "Pick summary or original." };

  try {
    await saveSettings(tenantId, { readingView });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save" };
  }

  revalidatePath("/items/[id]", "page");
  return {};
}
