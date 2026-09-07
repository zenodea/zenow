import type { ItemStatus } from "@reader/shared";

const LABELS: Record<ItemStatus, string> = {
  queued: "Queued",
  fetching: "Fetching",
  summarizing: "Reading",
  done: "Done",
  failed: "Failed",
};

export function StatusPill({ status }: { status: ItemStatus }) {
  if (status === "done") return null;
  const failed = status === "failed";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${
        failed ? "bg-accent-soft text-accent" : "bg-line/70 text-muted"
      }`}
    >
      {failed ? null : <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {LABELS[status]}
    </span>
  );
}
