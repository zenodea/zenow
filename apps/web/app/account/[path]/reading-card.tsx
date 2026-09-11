"use client";

import { useActionState, useState } from "react";
import type { ReadingView } from "@zenow/shared";
import { saveReadingView, type ReadingState } from "./actions";

const OPTIONS: { id: ReadingView; label: string; description: string }[] = [
  { id: "summary", label: "Summary", description: "Key points and a short write-up first." },
  { id: "original", label: "Original", description: "The page as it was published first." },
];

export function ReadingCard({ saved }: { saved: ReadingView }) {
  const [state, action] = useActionState<ReadingState, FormData>(saveReadingView, {});
  const [view, setView] = useState(saved);

  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">Reading</h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        What an article opens on. You can still switch to the other one on the page.
      </p>

      <form action={action} className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="submit"
            name="readingView"
            value={option.id}
            aria-pressed={option.id === view}
            onClick={() => setView(option.id)}
            className={`rounded-xl border p-3 text-left transition ${
              option.id === view ? "border-accent ring-1 ring-accent" : "border-line hover:border-ink"
            }`}
          >
            <span className="block text-sm font-medium">{option.label}</span>
            <span className="mt-0.5 block text-xs text-muted">{option.description}</span>
          </button>
        ))}
      </form>

      <p className="mt-3 text-sm text-accent" aria-live="polite">
        {state.error}
      </p>
    </section>
  );
}
