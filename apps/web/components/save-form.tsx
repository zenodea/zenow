"use client";

import { useState, type FormEvent } from "react";
import type { ItemCard } from "@zenow/shared";

type Mode = "save" | "research";

async function refresh(id: string, onSaved: (item: ItemCard) => void) {
  const fresh = await fetch(`/api/items?ids=${id}`).then((r) => r.json());
  if (fresh.items?.[0]) onSaved(fresh.items[0]);
}

export function SaveForm({ onSaved }: { onSaved: (item: ItemCard) => void }) {
  const [mode, setMode] = useState<Mode>("save");
  const [url, setUrl] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNote(null);

    const research = mode === "research";
    const response = await fetch(research ? "/api/research" : "/api/items", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(research ? { prompt } : { url: url.trim(), saved_from: "web" }),
    });
    const body = await response.json().catch(() => null);

    if (!response.ok) {
      setNote(body?.error ?? "That did not work");
      setBusy(false);
      return;
    }

    setBusy(false);
    if (research) {
      setPrompt("");
      setNote("Researching. This takes a minute or two.");
    } else {
      setUrl("");
      setNote(body.created ? null : "Already in your list");
    }
    await refresh(body.id, onSaved);
  }

  return (
    <div>
      <div className="mb-3 flex gap-1">
        {(["save", "research"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setMode(option);
              setNote(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              mode === option ? "bg-ink text-paper" : "text-muted hover:text-ink"
            }`}
          >
            {option === "save" ? "Link" : "Research"}
          </button>
        ))}
      </div>

      <form onSubmit={submit}>
        {mode === "save" ? (
          <div className="flex gap-2">
            {/*
              Deliberately not type="url". That makes the browser refuse to
              submit anything without a scheme, silently -- so typing
              "danluu.com/x", which is what people do on a phone, made the
              Save button look dead. canonicalizeUrl adds https:// itself, and
              a genuinely bad url comes back as a message instead of nothing.
              The keyboard hints matter on mobile too: without them iOS
              capitalises and autocorrects what you type into a link.
            */}
            <input
              type="text"
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="Paste a link"
              className="min-w-0 flex-1 rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || url.trim().length === 0}
              className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Saving" : "Save"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="What do you want to know?"
              rows={3}
              required
              minLength={10}
              className="w-full resize-y rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none placeholder:text-muted focus:border-accent"
            />
            <button
              type="submit"
              disabled={busy || prompt.trim().length < 10}
              className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
            >
              {busy ? "Starting" : "Research"}
            </button>
          </div>
        )}
      </form>

      {note ? <p className="mt-2 pl-4 text-xs text-muted">{note}</p> : null}
    </div>
  );
}
