"use client";

import { useState, type ReactNode } from "react";
import type { ReadingView } from "@zenow/shared";

const LABELS: Record<ReadingView, string> = { summary: "Summary", original: "Original" };

export function ReadingSwitch({
  initial,
  summary,
  original,
}: {
  initial: ReadingView;
  summary: ReactNode;
  original: ReactNode;
}) {
  const [view, setView] = useState(initial);

  return (
    <>
      <div role="tablist" className="mb-8 inline-flex gap-1 rounded-full border border-line p-1">
        {(Object.keys(LABELS) as ReadingView[]).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            onClick={() => setView(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              view === id ? "bg-ink text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {LABELS[id]}
          </button>
        ))}
      </div>

      <div hidden={view !== "summary"}>{summary}</div>
      <div hidden={view !== "original"}>{original}</div>
    </>
  );
}
