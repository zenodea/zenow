import { themeOption, type Theme, type ThemeMode } from "./theme";

/** WCAG relative luminance, for choosing which way round the mark should go. */
function luminance(hex: string): number {
  const channel = (pair: string) => {
    const value = parseInt(pair, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const r = channel(hex.slice(1, 3));
  const g = channel(hex.slice(3, 5));
  const b = channel(hex.slice(5, 7));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type IconPair = { bg: string; ring: string };

/**
 * The mark is the accent with the enso cut out of it, pale stroke on colour,
 * the way Zenow's own red one is drawn. Catppuccin's mauve and Gruvbox's orange
 * are too light to carry a pale ring, so those flip and take the dark side of
 * their own palette instead.
 *
 * The test is the accent's own lightness rather than which way round has more
 * contrast: the paler ring wins that on measurement almost everywhere, and
 * following it would redraw the mark rather than recolour it. Both candidates
 * come from the theme, so the icon is always made of the colours of the app it
 * opens.
 */
const PALE_ACCENT = 0.35;

export function iconColors(theme: Theme): { light: IconPair; dark: IconPair } {
  const option = themeOption(theme);

  const pick = (accent: string): IconPair => ({
    bg: accent,
    ring: luminance(accent) > PALE_ACCENT ? option.dark.paper : option.light.paper,
  });

  return { light: pick(option.light.accent), dark: pick(option.dark.accent) };
}

/**
 * One stroke with a deliberate gap, on a rounded square.
 *
 * A maskable icon is cropped to a circle by Android, so it loses the corners
 * and has to keep clear of the edge: it goes full bleed and draws the enso
 * smaller, inside the safe area.
 */
export function ensoSvg({
  light,
  dark,
  maskable = false,
  /** Left out for a favicon, which is sized by the browser. */
  size,
}: {
  light: IconPair;
  dark?: IconPair;
  maskable?: boolean;
  size?: number;
}): string {
  const radius = maskable ? 13 : 16;
  const stroke = maskable ? 5.3 : 6.5;
  const dash = 2 * Math.PI * radius;
  const corner = maskable ? 0 : 14;
  const dimensions = size ? ` width="${size}" height="${size}"` : "";

  // Two palettes in one file: a favicon left on "system" has to answer for
  // both, and an svg icon is allowed to carry the media query itself.
  const style = dark
    ? `<style>.bg{fill:${light.bg}}.ring{stroke:${light.ring}}` +
      `@media(prefers-color-scheme:dark){.bg{fill:${dark.bg}}.ring{stroke:${dark.ring}}}</style>`
    : `<style>.bg{fill:${light.bg}}.ring{stroke:${light.ring}}</style>`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"${dimensions}>` +
    style +
    `<rect class="bg" width="64" height="64" rx="${corner}"/>` +
    `<circle class="ring" cx="32" cy="32" r="${radius}" fill="none" stroke-width="${stroke}" ` +
    `stroke-linecap="round" stroke-dasharray="${(dash * 0.82).toFixed(1)} ${(dash * 0.19).toFixed(1)}" ` +
    `transform="rotate(-42 32 32)"/>` +
    `</svg>`
  );
}

/** The half to draw when only one can be drawn -- a png has no media queries. */
export function resolveHalf(theme: Theme, mode: ThemeMode): IconPair {
  const { light, dark } = iconColors(theme);
  return mode === "dark" ? dark : light;
}
