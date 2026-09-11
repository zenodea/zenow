"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const BUTTON =
  "grid size-9 shrink-0 place-items-center rounded-full border border-line text-muted transition hover:border-ink hover:text-ink disabled:opacity-40";

/**
 * The app's own confirmation rather than window.confirm, which on a phone is a
 * browser chrome sheet with the site's hostname at the top: it looks like the
 * page asking permission to do something to you, not like part of the app.
 */
function Confirm({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        // Tapping the backdrop dismisses; the panel itself must not.
        if (event.target === dialog.current) onCancel();
      }}
      className="m-auto w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink backdrop:bg-black/40 backdrop:backdrop-blur-sm"
    >
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 mb-5 text-sm text-muted">{body}</p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-full border border-line py-2 text-sm font-medium text-muted transition hover:text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="flex-1 rounded-full bg-accent py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

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
  const [asking, setAsking] = useState(false);

  async function retry() {
    setBusy("retry");
    await fetch(`/api/items/${id}/retry`, { method: "POST" });
    setBusy(null);
    router.refresh();
  }

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

  async function remove() {
    setAsking(false);
    setBusy("delete");
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer noopener" title="Open the original" className={BUTTON}>
          <LinkIcon />
        </a>
      ) : null}

      <button
        type="button"
        onClick={retry}
        disabled={busy !== null}
        title={url ? "Read it again" : "Run it again"}
        aria-label={url ? "Read it again" : "Run it again"}
        className={BUTTON}
      >
        <ReloadIcon spinning={busy === "retry"} />
      </button>

      <button
        type="button"
        onClick={toggleArchive}
        disabled={busy !== null}
        title={archived ? "Put it back in the list" : "Archive"}
        aria-label={archived ? "Put it back in the list" : "Archive"}
        className={BUTTON}
      >
        <ArchiveIcon restore={archived} />
      </button>

      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={busy !== null}
        title="Delete"
        aria-label="Delete"
        className={`${BUTTON} hover:border-accent hover:text-accent`}
      >
        <TrashIcon />
      </button>

      <Confirm
        open={asking}
        title="Delete this item?"
        body="The summary goes with it. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setAsking(false)}
      />
    </div>
  );
}

const STROKE = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE} className="size-4" aria-hidden>
      <path d="M14 4h6v6M20 4l-8.5 8.5" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function ReloadIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...STROKE} className={`size-4 ${spinning ? "animate-spin" : ""}`} aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4h-4" />
    </svg>
  );
}

function ArchiveIcon({ restore }: { restore: boolean }) {
  return (
    <svg viewBox="0 0 24 24" {...STROKE} className="size-4" aria-hidden>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      {restore ? <path d="M12 17v-5m0 0-2 2m2-2 2 2" /> : <path d="M10 12h4" />}
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" {...STROKE} className="size-4" aria-hidden>
      <path d="M4 7h16M10 7V5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v2" />
      <path d="M6 7v12a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}
