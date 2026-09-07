"use client";

import { useState, type FormEvent } from "react";
import type { ItemCard } from "@reader/shared";

export function SaveForm({ onSaved }: { onSaved: (item: ItemCard) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNote(null);

    const response = await fetch("/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url, saved_from: "web" }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setNote(body?.error ?? "Could not save that");
      setBusy(false);
      return;
    }

    setUrl("");
    setBusy(false);
    setNote(body.created ? null : "Already in your list");

    const fresh = await fetch(`/api/items?ids=${body.id}`).then((r) => r.json());
    if (fresh.items?.[0]) onSaved(fresh.items[0]);
  }

  return (
    <form onSubmit={onSubmit}>
      <div className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Paste a link to save"
          required
          className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Saving" : "Save"}
        </button>
      </div>
      {note ? <p className="mt-2 pl-4 text-xs text-muted">{note}</p> : null}
    </form>
  );
}
