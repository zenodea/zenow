import { ImageResponse } from "next/og";
import { ensoSvg, iconColors, resolveHalf } from "@/lib/icon";
import { defaultTheme, defaultThemeMode, isTheme, isThemeMode } from "@zenow/shared";

/**
 * The app's mark, in whatever theme is asked for.
 *
 * The theme travels in the query rather than being read from the session,
 * because the browser fetches icons and the manifest without cookies -- so the
 * page has to name the theme when it links to them. That also means every
 * variant has its own url and can be cached hard.
 *
 * Without a size it answers with svg, which is what a favicon wants: it scales,
 * and on "system" it carries both halves and switches itself. With a size it
 * rasterises, for the places that will not take an svg -- an installed app icon
 * on Android, and the home screen on iOS.
 */
const SIZES = new Set([180, 192, 512]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const themeParam = params.get("theme");
  const modeParam = params.get("mode");
  const theme = isTheme(themeParam) ? themeParam : defaultTheme;
  const mode = isThemeMode(modeParam) ? modeParam : defaultThemeMode;
  const maskable = params.get("purpose") === "maskable";

  const size = Number(params.get("size"));
  const immutable = "public, max-age=31536000, immutable";

  if (!size) {
    const { light, dark } = iconColors(theme);
    const svg = ensoSvg({
      light: mode === "dark" ? dark : light,
      // Only "system" needs both; a fixed mode has already made the choice.
      dark: mode === "system" ? dark : undefined,
      maskable,
    });

    return new Response(svg, {
      headers: { "content-type": "image/svg+xml", "cache-control": immutable },
    });
  }

  if (!SIZES.has(size)) {
    return new Response("Unsupported size", { status: 400 });
  }

  const half = resolveHalf(theme, mode);
  const svg = ensoSvg({ light: half, maskable, size });

  // Satori draws the mark by rasterising the same svg the favicon uses, so the
  // two cannot drift apart.
  return new ImageResponse(
    (
      <img
        width={size}
        height={size}
        src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`}
        alt=""
      />
    ),
    { width: size, height: size, headers: { "cache-control": immutable } },
  );
}
