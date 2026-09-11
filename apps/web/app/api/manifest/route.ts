import type { MetadataRoute } from "next";
import { themeOption } from "@/lib/theme";
import { defaultTheme, defaultThemeMode, isTheme, isThemeMode } from "@zenow/shared";

/**
 * The installed app's own colours: the splash screen, the title bar, and the
 * icon the launcher keeps.
 *
 * A route rather than app/manifest.ts because the browser fetches a manifest
 * with credentials omitted -- there is no session to read the theme from, so
 * the page passes it in the link instead.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;

  const themeParam = params.get("theme");
  const modeParam = params.get("mode");
  const theme = isTheme(themeParam) ? themeParam : defaultTheme;
  const mode = isThemeMode(modeParam) ? modeParam : defaultThemeMode;

  const option = themeOption(theme);
  const half = mode === "dark" ? option.dark : option.light;
  const icon = (extra: string) => `/api/icon?theme=${theme}&mode=${mode}&${extra}`;

  const manifest: MetadataRoute.Manifest = {
    name: "Zenow",
    short_name: "Zenow",
    description: "Save a link. Get the substance back.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: half.paper,
    theme_color: half.accent,
    orientation: "portrait-primary",
    icons: [
      { src: icon("size=192"), sizes: "192x192", type: "image/png" },
      { src: icon("size=512"), sizes: "512x512", type: "image/png" },
      // Trimmed to survive Android's circular mask, which crops the corners.
      {
        src: icon("size=512&purpose=maskable"),
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Puts Zenow in the system share sheet, which is what replaces the
    // extension on a phone.
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };

  return Response.json(manifest, {
    headers: { "content-type": "application/manifest+json" },
  });
}
