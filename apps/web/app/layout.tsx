import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { ServiceWorker } from "@/components/service-worker";
import { SideScroller } from "@/components/side-scroller";
import { ThemeScript } from "@/components/theme-script";
import { themeColor } from "@/lib/theme";
import { getThemePreference } from "@/lib/theme-server";
import "./globals.css";

// The icons and the manifest are fetched by the browser without cookies, so
// they cannot look the theme up for themselves -- it is named in the link.
export async function generateMetadata(): Promise<Metadata> {
  const { theme, mode } = await getThemePreference();
  const look = `theme=${theme}&mode=${mode}`;

  return {
    title: "Zenow",
    description: "Save a link. Get the substance back.",
    applicationName: "Zenow",
    appleWebApp: { capable: true, title: "Zenow", statusBarStyle: "default" },
    manifest: `/api/manifest?${look}`,
    icons: {
      icon: { url: `/api/icon?${look}`, type: "image/svg+xml" },
      // iOS will not take an svg here, and bakes the icon in at install.
      apple: `/api/icon?${look}&size=180`,
    },
  };
}

export async function generateViewport(): Promise<Viewport> {
  const { theme, mode } = await getThemePreference();

  return {
    // The browser's own chrome takes the colour of the page behind the
    // content, so the installed app does not wear one theme around another.
    themeColor: themeColor(theme, mode),
    // Installed, the app runs under the notch and the home indicator.
    viewportFit: "cover",
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { theme, mode } = await getThemePreference();
  const renderedAt = Date.now();

  // Password managers, Dark Reader and similar extensions add attributes to
  // these two elements before React hydrates, which React reports as a
  // mismatch. Suppressing here covers the attributes only, one level deep.
  //
  // data-side-scroller hides the native scrollbar (see globals.css). It is set
  // here rather than by <SideScroller> on mount so that it holds from the very
  // first paint and does not depend on hydration having run: setting it from
  // the client meant the real bar was still drawn beside the header until the
  // page was interactive, and stayed there for good if hydration never landed.
  //
  // data-theme and data-mode carry the saved look. They are rendered here so
  // the first paint is already in the right palette; <ThemeScript> only steps
  // in when this html came from the offline cache and is out of date.
  return (
    <html
      lang="en"
      data-side-scroller
      data-theme={theme}
      data-mode={mode}
      suppressHydrationWarning
    >
      <body suppressHydrationWarning>
        <ThemeScript theme={theme} mode={mode} at={renderedAt} />
        <Providers>{children}</Providers>
        <SideScroller />
        <ServiceWorker />
      </body>
    </html>
  );
}
