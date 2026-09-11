/**
 * The look of the app: a palette, and whether its light or dark half is used.
 *
 * The two are separate on purpose. "Follow the system" is the default and was
 * the only behaviour before, so an existing reader sees no change; picking a
 * palette does not force them to also start choosing when it goes dark.
 */
export const themes = ["base", "catppuccin", "gruvbox", "everforest"] as const;
export type Theme = (typeof themes)[number];

export const themeModes = ["system", "light", "dark"] as const;
export type ThemeMode = (typeof themeModes)[number];

export const defaultTheme: Theme = "base";
export const defaultThemeMode: ThemeMode = "system";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (themes as readonly string[]).includes(value);
}

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === "string" && (themeModes as readonly string[]).includes(value);
}
