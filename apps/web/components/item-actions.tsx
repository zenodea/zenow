"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const BUTTON =
  "rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-ink hover:text-ink disabled:opacity-40";

export function ItemActions({ id, url }: { id: string; url: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"retry" | "delete" | null>(null);

  async function retry() {
    setBusy("retry");
    await fetch(`/api/items/${id}/retry`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

  async function remove() {
    if (!confirm("Delete this item?")) return;
    setBusy("delete");
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <a href={url} target="_blank" rel="noreferrer noopener" className={BUTTON}>
        Original
      </a>
      <button type="button" onClick={retry} disabled={busy !== null} className={BUTTON}>
        {busy === "retry" ? "Queued" : "Re-read"}
      </button>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className={`${BUTTON} hover:border-accent hover:text-accent`}
      >
        Delete
      </button>
    </div>
  );
}
