import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Zenow",
    short_name: "Zenow",
    description: "Save a link. Get the substance back.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#faf9f7",
    theme_color: "#ef4056",
    orientation: "portrait-primary",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      // Trimmed to survive Android's circular mask, which crops the corners.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Puts Zenow in the system share sheet, which is what replaces the
    // extension on a phone.
    share_target: {
      action: "/share",
      method: "GET",
      params: { title: "title", text: "text", url: "url" },
    },
  };
}
