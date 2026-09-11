"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { label: "All", params: {} },
  { label: "Unread", params: { unread: "true" } },
  { label: "Archive", params: { archived: "true" } },
  { label: "Failed", params: { status: "failed" } },
] as const;

const FILTER_KEYS = ["unread", "status", "archived"] as const;

export function ListControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const activeTab =
    TABS.find((tab) =>
      FILTER_KEYS.every(
        (key) => (params.get(key) ?? undefined) === (tab.params as Record<string, string>)[key],
      ),
    ) ?? TABS[0];
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [digest, setDigest] = useState<"idle" | "working" | string>("idle");

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

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <nav className="flex gap-1">
        {TABS.map((tab) => {
          const active = tab.label === activeTab.label;
          return (
            <Link
              key={tab.label}
              href={href(tab.params as Record<string, string>)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={weeklyDigest}
        disabled={digest === "working"}
        title="What this week was about"
        className="ml-auto shrink-0 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-ink hover:text-ink disabled:opacity-40"
      >
        {digest === "working" ? "Writing…" : "This week"}
      </button>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search your list"
        className="w-full max-w-56 rounded-full border border-line bg-surface px-4 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
      />

      {digest !== "idle" && digest !== "working" ? (
        <p className="w-full text-xs text-accent">{digest}</p>
      ) : null}
    </div>
  );
}
