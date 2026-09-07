"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

const TABS = [
  { label: "All", status: undefined },
  { label: "Unread", status: "queued" },
  { label: "Failed", status: "failed" },
] as const;

export function ListControls() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const activeStatus = params.get("status") ?? undefined;
  const [query, setQuery] = useState(params.get("q") ?? "");

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

  function href(status: string | undefined): string {
    const next = new URLSearchParams(params.toString());
    if (status) next.set("status", status);
    else next.delete("status");
    return `${pathname}?${next}`;
  }

  return (
    <div className="mb-8 flex flex-wrap items-center gap-3">
      <nav className="flex gap-1">
        {TABS.map((tab) => {
          const active = tab.status === activeStatus;
          return (
            <Link
              key={tab.label}
              href={href(tab.status)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                active ? "bg-ink text-paper" : "text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search your list"
        className="ml-auto w-full max-w-56 rounded-full border border-line bg-surface px-4 py-1.5 text-xs outline-none placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}
