import { themeModes, themes, type Theme, type ThemeMode } from "@zenow/shared";

export type { Theme, ThemeMode };
export { themes, themeModes };

/** Where the browser keeps its own copy. See <ThemeScript> for why it exists. */
export const THEME_STORAGE_KEY = "zenow.theme";

type Half = { paper: string; surface: string; ink: string; accent: string };

export type ThemeOption = {
  id: Theme;
  label: string;
  /** What the two halves are called upstream, so the names are recognisable. */
  variants: string;
  light: Half;
  dark: Half;
};

/**
 * Only the four colours the picker paints into its preview tile. The palettes
 * themselves live in globals.css, which is what actually renders the app --
 * these are a deliberate copy, kept to the handful needed to show a theme
 * before it is chosen. Change a palette there and change its swatch here.
 */
export const THEME_OPTIONS: readonly ThemeOption[] = [
  {
    id: "base",
    label: "Base",
    variants: "Zenow's own",
    light: { paper: "#fbfaf8", surface: "#ffffff", ink: "#1a1a1a", accent: "#ef4056" },
    dark: { paper: "#151517", surface: "#1d1d21", ink: "#ececef", accent: "#ff6076" },
  },
  {
    id: "catppuccin",
    label: "Catppuccin",
    variants: "Latte and Mocha",
    light: { paper: "#e6e9ef", surface: "#eff1f5", ink: "#4c4f69", accent: "#8839ef" },
    dark: { paper: "#181825", surface: "#1e1e2e", ink: "#cdd6f4", accent: "#cba6f7" },
  },
  {
    id: "gruvbox",
    label: "Gruvbox",
    variants: "light and dark",
    light: { paper: "#fbf1c7", surface: "#f9f5d7", ink: "#3c3836", accent: "#af3a03" },
    dark: { paper: "#1d2021", surface: "#282828", ink: "#ebdbb2", accent: "#fe8019" },
  },
  {
    id: "everforest",
    label: "Everforest",
    variants: "light and dark",
    light: { paper: "#f4f0d9", surface: "#fdf6e3", ink: "#5c6a72", accent: "#8da101" },
    dark: { paper: "#2d353b", surface: "#343f44", ink: "#d3c6aa", accent: "#a7c080" },
  },
];

export const MODE_OPTIONS: readonly { id: ThemeMode; label: string }[] = [
  { id: "system", label: "System" },
  { id: "light", label: "Light" },
  { id: "dark", label: "Dark" },
];

export function themeOption(theme: Theme): ThemeOption {
  return THEME_OPTIONS.find((option) => option.id === theme) ?? THEME_OPTIONS[0];
}

/**
 * The colour the browser paints its own chrome with -- the address bar on
 * Android, the status bar area of the installed app. It should be the page
 * behind the content, not the accent, or the app appears to be wearing a
 * different theme to the one it is in.
 */
export function themeColor(theme: Theme, mode: ThemeMode) {
  const { light, dark } = themeOption(theme);
  if (mode === "light") return light.paper;
  if (mode === "dark") return dark.paper;
  return [
    { media: "(prefers-color-scheme: light)", color: light.paper },
    { media: "(prefers-color-scheme: dark)", color: dark.paper },
  ];
}
