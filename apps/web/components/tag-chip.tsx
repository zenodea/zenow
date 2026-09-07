import Link from "next/link";

export function TagChip({ tag, count, active = false }: { tag: string; count?: number; active?: boolean }) {
  return (
    <Link
      href={active ? "/" : `/?tag=${encodeURIComponent(tag)}`}
      title={active ? "Clear this filter" : `Show everything tagged ${tag}`}
      className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
        active ? "bg-accent text-white" : "bg-line/60 text-muted hover:bg-line hover:text-ink"
      }`}
    >
      {tag}
      {count === undefined ? null : <span className="ml-1 opacity-60">{count}</span>}
    </Link>
  );
}
