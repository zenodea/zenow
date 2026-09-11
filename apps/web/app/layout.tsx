import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "./providers";
import { ServiceWorker } from "@/components/service-worker";
import { SideScroller } from "@/components/side-scroller";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zenow",
  description: "Save a link. Get the substance back.",
  applicationName: "Zenow",
  appleWebApp: { capable: true, title: "Zenow", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#ef4056",
  // Installed, the app runs under the notch and the home indicator.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Password managers, Dark Reader and similar extensions add attributes to
  // these two elements before React hydrates, which React reports as a
  // mismatch. Suppressing here covers the attributes only, one level deep.
  //
  // data-side-scroller hides the native scrollbar (see globals.css). It is set
  // here rather than by <SideScroller> on mount so that it holds from the very
  // first paint and does not depend on hydration having run: setting it from
  // the client meant the real bar was still drawn beside the header until the
  // page was interactive, and stayed there for good if hydration never landed.
  return (
    <html lang="en" data-side-scroller suppressHydrationWarning>
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
        <SideScroller />
        <ServiceWorker />
      </body>
    </html>
  );
}
