"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { TagChip } from "./tag-chip";

export type FeedView = "all" | "unread" | "archive";

const TABS = [
  { id: "all", label: "All", params: { view: "all" } },
  { id: "unread", label: "Unread", params: { unread: "true" } },
  { id: "archive", label: "Archive", params: { archived: "true" } },
] as const;

const FILTER_KEYS = ["view", "unread", "status", "archived"] as const;

const ICON = "grid size-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-line/60 hover:text-ink";

/**
 * One row, because everything above the first article is a reason not to read
 * one. Search and the tag list are a tap away rather than always on screen,
 * and whatever is currently filtering the list is shown next to the tabs so a
 * short list never looks like an empty one.
 */
export function Toolbar({
  tags,
  view,
  composing,
  onCompose,
}: {
  tags: { tag: string; count: number }[];
  view: FeedView;
  composing: boolean;
  onCompose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const activeTag = params.get("tag");
  const failed = params.get("status") === "failed";

  const [searching, setSearching] = useState(Boolean(params.get("q")));
  const [more, setMore] = useState(false);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [digest, setDigest] = useState<"idle" | "working" | string>("idle");
  const field = useRef<HTMLInputElement>(null);

  // Debounced so typing does not fire a request per keystroke.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (query === current) return;

    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (query) next.set("q", query);
      else next.delete("q");
      router.replace(`${pathname}?${next}`);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, params, pathname, router]);

  function href(tabParams: Record<string, string>): string {
    const next = new URLSearchParams(params.toString());
    for (const key of FILTER_KEYS) next.delete(key);
    for (const [key, value] of Object.entries(tabParams)) next.set(key, value);
    return `${pathname}?${next}`;
  }

  function without(key: string): string {
    const next = new URLSearchParams(params.toString());
    next.delete(key);
    const rest = next.toString();
    return rest ? `${pathname}?${rest}` : pathname;
  }

  async function weeklyDigest() {
    setDigest("working");
    const response = await fetch("/api/digest", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ week: "this" }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setDigest(body?.error ?? "Could not write the digest");
      return;
    }
    setDigest("idle");
    router.push(`/items/${body.id}`);
  }

  if (searching) {
    return (
      <div className="mb-5 flex items-center gap-2">
        <input
          ref={field}
          autoFocus
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => event.key === "Escape" && field.current?.blur()}
          placeholder="Search your list"
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setSearching(false);
          }}
          className="shrink-0 px-1 text-sm text-muted transition hover:text-ink"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="flex items-center gap-1">
        <nav className="flex min-w-0 gap-0.5">
          {TABS.map((tab) => {
            const active = tab.id === view && !failed;
            return (
              <Link
                key={tab.id}
                href={href(tab.params as Record<string, string>)}
                className={`rounded-full px-3 py-1.5 text-[13px] font-medium transition ${
                  active ? "bg-ink text-paper" : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-0.5">
          <button type="button" onClick={() => setSearching(true)} aria-label="Search" className={ICON}>
            <SearchIcon />
          </button>
          <button
            type="button"
            onClick={() => setMore((open) => !open)}
            aria-label="Tags and filters"
            aria-expanded={more}
            className={`${ICON} ${more || activeTag || failed ? "bg-line/60 text-ink" : ""}`}
          >
            <TagIcon />
          </button>
          <button
            type="button"
            onClick={onCompose}
            aria-label="Save a link"
            aria-expanded={composing}
            className={`grid size-8 shrink-0 place-items-center rounded-full transition ${
              composing ? "bg-line text-ink" : "bg-accent text-white hover:opacity-90"
            }`}
          >
            <PlusIcon />
          </button>
        </div>
      </div>

      {/* Whatever is narrowing the list, spelled out, so a short list is never
          a mystery. */}
      {activeTag || failed ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <span>Showing</span>
          {activeTag ? (
            <Link
              href={without("tag")}
              className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white"
            >
              {activeTag} ✕
            </Link>
          ) : null}
          {failed ? (
            <Link
              href={without("status")}
              className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-white"
            >
              failed ✕
            </Link>
          ) : null}
        </div>
      ) : null}

      {more ? (
        <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface p-3">
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map(({ tag, count }) => (
                <TagChip key={tag} tag={tag} count={count} active={activeTag === tag} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">Tags appear once a few things have been summarised.</p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <Link
              href={failed ? without("status") : href({ status: "failed" })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                failed ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              Failed
            </Link>
            <button
              type="button"
              onClick={weeklyDigest}
              disabled={digest === "working"}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition hover:border-ink hover:text-ink disabled:opacity-40"
            >
              {digest === "working" ? "Writing…" : "This week"}
            </button>
            {digest !== "idle" && digest !== "working" ? (
              <span className="text-xs text-accent">{digest}</span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
      <path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z" strokeLinejoin="round" />
      <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="size-4" aria-hidden>
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}
