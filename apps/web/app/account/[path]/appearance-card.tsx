"use client";

import { useActionState, useState } from "react";
import { saveAppearance, type AppearanceState } from "./actions";
import {
  MODE_OPTIONS,
  THEME_OPTIONS,
  THEME_STORAGE_KEY,
  themeColor,
  type Theme,
  type ThemeMode,
  type ThemeOption,
} from "@/lib/theme";

/**
 * Paint the choice on before the server has heard about it, and keep it in
 * localStorage so it survives a reload that beats the write. The round trip
 * exists to make it stick across devices; nothing waits for it.
 */
function apply(theme: Theme, mode: ThemeMode) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.dataset.mode = mode;

  // The tab icon, the installed app's colours and the browser chrome are all
  // named in <head> with the theme in the query, so they are re-pointed rather
  // than re-fetched blind. Without this they would keep the old theme until the
  // next full page load.
  const look = `theme=${theme}&mode=${mode}`;
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="icon"]')) {
    link.href = `/api/icon?${look}`;
  }
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="apple-touch-icon"]')) {
    link.href = `/api/icon?${look}&size=180`;
  }
  for (const link of document.querySelectorAll<HTMLLinkElement>('link[rel="manifest"]')) {
    link.href = `/api/manifest?${look}`;
  }
  // theme-color is one tag per media query, so the set is rebuilt rather than
  // edited: "system" needs two and a fixed mode needs one.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) meta.remove();
  const colors = themeColor(theme, mode);
  for (const entry of typeof colors === "string" ? [{ color: colors }] : colors) {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.content = entry.color;
    if ("media" in entry) meta.media = entry.media;
    document.head.append(meta);
  }

  // Stamped now, so it outranks the html of any page already sitting in the
  // offline cache. See <ThemeScript>.
  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify({ theme, mode, at: Date.now() }));
  } catch {
    // Private windows and blocked storage cost the offline correction, nothing
    // else: the server still has the answer.
  }
}

/** A tile shows both halves of a palette, since the mode is chosen separately. */
function Preview({ option }: { option: ThemeOption }) {
  return (
    <span className="flex h-14 overflow-hidden rounded-md border border-line">
      {[option.light, option.dark].map((half, index) => (
        <span
          key={index}
          className="flex flex-1 flex-col justify-center gap-1 p-2"
          style={{ backgroundColor: half.paper }}
        >
          <span
            className="flex items-center gap-1 rounded-sm p-1"
            style={{ backgroundColor: half.surface }}
          >
            <span className="h-1 flex-1 rounded-full" style={{ backgroundColor: half.ink }} />
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: half.accent }}
            />
          </span>
          <span
            className="h-1 w-2/3 rounded-full opacity-50"
            style={{ backgroundColor: half.ink }}
          />
        </span>
      ))}
    </span>
  );
}

export function AppearanceCard({ saved }: { saved: { theme: Theme; mode: ThemeMode } }) {
  const [state, action] = useActionState<AppearanceState, FormData>(saveAppearance, {});
  const [theme, setTheme] = useState<Theme>(saved.theme);
  const [mode, setMode] = useState<ThemeMode>(saved.mode);

  // Two forms rather than one, so that each button posts its own value under
  // the name the action reads and the other half rides along hidden. Both are
  // real submits, so a browser with no javascript still changes the theme --
  // it just takes a page load rather than a paint.
  return (
    <div className="space-y-6">
      <form action={action}>
        <input type="hidden" name="themeMode" value={mode} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Theme</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THEME_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="submit"
                name="theme"
                value={option.id}
                aria-pressed={option.id === theme}
                onClick={() => {
                  setTheme(option.id);
                  apply(option.id, mode);
                }}
                className={`rounded-xl border p-2 text-left transition ${
                  option.id === theme
                    ? "border-accent ring-1 ring-accent"
                    : "border-line hover:border-ink"
                }`}
              >
                <Preview option={option} />
                <span className="mt-2 block text-sm font-medium">{option.label}</span>
                <span className="block text-xs text-muted">{option.variants}</span>
              </button>
            ))}
          </div>
        </fieldset>
      </form>

      <form action={action}>
        <input type="hidden" name="theme" value={theme} />
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Light or dark</legend>
          <div className="flex gap-1">
            {MODE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="submit"
                name="themeMode"
                value={option.id}
                aria-pressed={option.id === mode}
                onClick={() => {
                  setMode(option.id);
                  apply(theme, option.id);
                }}
                className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                  option.id === mode ? "bg-ink text-paper" : "text-muted hover:text-ink"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted">
            System follows whatever your device is doing, and changes with it.
          </p>
        </fieldset>
      </form>

      {/* Only failure is worth saying. The theme is on the page the moment you
          click it and in localStorage with it, so a successful save has nothing
          left to report -- and waiting on the round trip to say so made the
          fastest thing in the app feel like the slowest. */}
      <p className="text-sm text-accent" aria-live="polite">
        {state.error}
      </p>
    </div>
  );
}
