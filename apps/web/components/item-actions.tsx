"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const BUTTON =
  "rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-ink hover:text-ink disabled:opacity-40";

export function ItemActions({
  id,
  url,
  archived,
}: {
  id: string;
  url: string | null;
  archived: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"retry" | "delete" | "archive" | null>(null);

  async function toggleArchive() {
    setBusy("archive");
    await fetch(`/api/items/${id}/archive`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ archived: !archived }),
    });
    setBusy(null);
    // Back to the list it just left, rather than a page that no longer belongs
    // to the view you came from.
    if (!archived) router.push("/");
    router.refresh();
  }

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
      {url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" className={BUTTON}>
          Original
        </a>
      ) : null}
      <button type="button" onClick={retry} disabled={busy !== null} className={BUTTON}>
        {busy === "retry" ? "Queued" : url ? "Re-read" : "Re-run"}
      </button>
      <button type="button" onClick={toggleArchive} disabled={busy !== null} className={BUTTON}>
        {archived ? "Restore" : "Archive"}
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
