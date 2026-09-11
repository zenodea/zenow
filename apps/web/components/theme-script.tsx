import { THEME_STORAGE_KEY, type Theme, type ThemeMode } from "@/lib/theme";

/**
 * Runs before anything paints, and settles which of two answers about the
 * theme is right.
 *
 * The server puts the saved theme straight onto <html>, so a page fetched from
 * the network is already correct and there is nothing to fix. But pages are
 * also served from the service worker cache when there is no connection, and
 * that html was rendered whenever it happened to be cached -- possibly before
 * the reader changed their theme on another device. The browser keeps its own
 * copy for exactly that case.
 *
 * Whichever of the two is newer wins, which is why both carry a timestamp. A
 * live render is stamped now and so always beats the stored copy, and refreshes
 * it on the way past; a stale cached page loses to it and is corrected.
 */
export function ThemeScript({ theme, mode, at }: { theme: Theme; mode: ThemeMode; at: number }) {
  const source = `(function(){try{
var e=document.documentElement,at=${at},raw=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
if(raw){var p=JSON.parse(raw);if(p&&p.at>at){if(p.theme)e.dataset.theme=p.theme;if(p.mode)e.dataset.mode=p.mode;return;}}
localStorage.setItem(${JSON.stringify(THEME_STORAGE_KEY)},JSON.stringify({theme:e.dataset.theme,mode:e.dataset.mode,at:at}));
}catch(_){}})();`;

  return <script dangerouslySetInnerHTML={{ __html: source }} />;
}
