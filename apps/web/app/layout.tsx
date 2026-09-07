import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zenow",
  description: "Saved links, read for you.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  // Password managers, Dark Reader and similar extensions add attributes to
  // these two elements before React hydrates, which React reports as a
  // mismatch. Suppressing here covers the attributes only, one level deep.
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
