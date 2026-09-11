import { notFound } from "next/navigation";
import { z } from "zod";
import Markdown from "react-markdown";
import { Header } from "@/components/header";
import { LiveItem } from "@/components/live-item";
import { SourceBadge } from "@/components/item-card";
import { MarkRead } from "@/components/mark-read";
import { PageTransition } from "@/components/page-transition";
import { BackButton } from "@/components/back-button";
import { ItemActions } from "@/components/item-actions";
import { Listen } from "@/components/listen";
import { OriginalContent } from "@/components/original-content";
import { ReadingSwitch } from "@/components/reading-switch";
import { StatusPill } from "@/components/status-pill";
import { TagChip } from "@/components/tag-chip";
import { requireTenant } from "@/lib/guard";
import { getItemDetail } from "@/lib/items";
import { getReadingView } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Item = NonNullable<Awaited<ReturnType<typeof getItemDetail>>>;

const STALL_MS = 10 * 60_000;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function byline(item: Item): string[] {
  const meta = item.content?.meta ?? {};
  const parts = [hostOf(item.url)];

  const author = meta.author ?? meta.byline ?? meta.channel ?? meta.subreddit;
  if (typeof author === "string" && author.trim()) parts.push(author.trim());

  if (typeof meta.published_at === "string") {
    const date = new Date(meta.published_at);
    if (!Number.isNaN(date.getTime())) {
      parts.push(date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }));
    }
  }

  if (typeof meta.pages === "number") parts.push(`${meta.pages} pages`);
  if (item.read_time_min) parts.push(`${item.read_time_min} min read`);
  return parts;
}

export default async function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { tenantId } = await requireTenant();

  const { id } = await params;
  // Postgres rejects a non-uuid outright, which surfaced as a 500 rather than
  // the 404 that a made-up url deserves.
  if (!z.uuid().safeParse(id).success) notFound();

  const [item, readingView] = await Promise.all([getItemDetail(tenantId, id), getReadingView(tenantId)]);
  if (!item) notFound();

  const summary = item.summary ? <Summary title={item.title ?? "This item"} summary={item.summary} /> : null;
  const original = item.content ? <OriginalContent html={item.content.html} text={item.content.text} /> : null;

  const settled = item.status === "done" || item.status === "failed";
  const stalled = !settled && Date.now() - Date.parse(item.updated_at) > STALL_MS;
  const trouble = !item.summary && (item.status === "failed" || Boolean(item.error) || stalled);

  return (
    <>
      <Header />
      <MarkRead id={item.id} alreadyRead={item.read} />
      <LiveItem id={item.id} status={item.status} />
      <PageTransition>
      <main className="mx-auto max-w-5xl px-6 sm:pr-9 pt-8 pb-24">
        <div className="mb-6 flex justify-end">
          <ItemActions
            id={item.id}
            url={item.url.startsWith("zenow:") ? null : item.url}
            archived={item.archived}
          />
        </div>

        <div className="mb-3 flex items-center gap-3">
          <p className="text-[11px] tracking-[0.12em] text-muted uppercase">
            {byline(item).join("  ·  ")}
          </p>
          <SourceBadge type={item.source_type} />
        </div>

        <h1 className="mb-5 text-3xl leading-[1.2] font-bold tracking-tight text-balance wrap-break-word sm:text-4xl">
          {item.title ?? item.url}
        </h1>

        {item.tags.length > 0 ? (
          <div className="mb-6 flex flex-wrap gap-1.5">
            {item.tags.map((tag) => (
              <TagChip key={tag} tag={tag} />
            ))}
          </div>
        ) : null}

        {item.status === "done" ? null : (
          <div className="mb-6">
            <StatusPill status={item.status} />
          </div>
        )}

        {item.error && !original ? (
          <p
            className={`mb-8 rounded-xl border border-line px-4 py-3 text-sm ${
              item.status === "failed" ? "bg-accent-soft text-accent" : "bg-surface text-muted"
            }`}
          >
            {item.status === "failed" ? item.error : `Still trying — ${item.error}`}
          </p>
        ) : null}

        {summary && original ? (
          <ReadingSwitch initial={readingView} summary={summary} original={original} />
        ) : summary ? (
          summary
        ) : original ? (
          <>
            {trouble ? <SummaryNotice failed={item.status === "failed"} error={item.error} /> : null}
            {original}
          </>
        ) : (
          <p className="text-sm text-muted">
            {item.status === "failed"
              ? "No summary was produced."
              : stalled
                ? "This is taking longer than it should. The worker may be offline."
                : item.source_type === "research"
                  ? "Researching. Searching the web and reading sources — this takes a minute or two."
                  : "Reading it now..."}
          </p>
        )}
      </main>
      <BackButton />
      </PageTransition>
    </>
  );
}

function SummaryNotice({ failed, error }: { failed: boolean; error: string | null }) {
  return (
    <p className="mb-8 flex items-start gap-2 text-xs text-muted" title={error ?? undefined}>
      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-accent" />
      <span className="line-clamp-2 min-w-0 wrap-break-word">
        {failed ? "The summary could not be made, so this is the original." : "The summary is late, so this is the original for now."}
        {error ? ` ${error}` : ""}
      </span>
    </p>
  );
}

function Summary({ title, summary }: { title: string; summary: NonNullable<Item["summary"]> }) {
  const [hero, ...rest] = summary.images;

  return (
    <>
      {hero ? (
        <figure className="mb-8">
          <img src={hero.url} alt={hero.alt ?? hero.caption} className="w-full rounded-xl border border-line" />
          <figcaption className="mt-2 text-xs text-muted">{hero.caption}</figcaption>
        </figure>
      ) : null}

      <Listen title={title} summaryMd={[...summary.key_points, summary.summary_md].join("\n\n")} />

      {summary.key_points.length > 0 ? (
        <ul className="mb-8 space-y-2.5 rounded-xl border border-line bg-surface px-5 py-4">
          {summary.key_points.map((point) => (
            <li key={point} className="flex gap-3 text-[15px] leading-relaxed">
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 wrap-break-word">{point}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="prose-reader">
        <Markdown>{summary.summary_md}</Markdown>
      </div>

      {rest.length > 0 ? (
        <div className="mt-8 space-y-6">
          {rest.map((image) => (
            <figure key={image.url}>
              <img
                src={image.url}
                alt={image.alt ?? image.caption}
                loading="lazy"
                className="w-full rounded-xl border border-line"
              />
              <figcaption className="mt-2 text-xs text-muted">{image.caption}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}

      <p className="mt-8 text-[11px] text-muted">
        Summarised by {summary.model}
        {summary.tokens_in && summary.tokens_out
          ? ` · ${summary.tokens_in.toLocaleString()} in / ${summary.tokens_out.toLocaleString()} out`
          : ""}
      </p>
    </>
  );
}
