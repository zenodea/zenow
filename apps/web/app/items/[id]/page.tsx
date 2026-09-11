import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import Markdown from "react-markdown";
import { Header } from "@/components/header";
import { LiveItem } from "@/components/live-item";
import { SourceBadge } from "@/components/item-card";
import { MarkRead } from "@/components/mark-read";
import { PageTransition } from "@/components/page-transition";
import { ItemActions } from "@/components/item-actions";
import { Listen } from "@/components/listen";
import { OriginalContent } from "@/components/original-content";
import { StatusPill } from "@/components/status-pill";
import { TagChip } from "@/components/tag-chip";
import { requireTenant } from "@/lib/guard";
import { getItemDetail } from "@/lib/items";

export const dynamic = "force-dynamic";

type Item = NonNullable<Awaited<ReturnType<typeof getItemDetail>>>;

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

  const item = await getItemDetail(tenantId, id);
  if (!item) notFound();

  const [hero, ...rest] = item.summary?.images ?? [];

  return (
    <>
      <Header />
      <MarkRead id={item.id} alreadyRead={item.read} />
      <LiveItem id={item.id} status={item.status} />
      <PageTransition>
      <main className="mx-auto max-w-5xl px-6 pt-8 pb-24">
        <div className="mb-6 flex items-center justify-between gap-4">
          <Link href="/" transitionTypes={["nav-out"]} className="shrink-0 text-sm text-muted hover:text-ink">
            ← My list
          </Link>
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

        <h1 className="mb-5 text-3xl leading-[1.2] font-bold tracking-tight text-balance sm:text-4xl">
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

        {item.error ? (
          <p
            className={`mb-8 rounded-xl border border-line px-4 py-3 text-sm ${
              item.status === "failed" ? "bg-accent-soft text-accent" : "bg-surface text-muted"
            }`}
          >
            {item.status === "failed" ? item.error : `Still trying — ${item.error}`}
          </p>
        ) : null}

        {hero ? (
          <figure className="mb-8">
            <img src={hero.url} alt={hero.alt ?? hero.caption} className="w-full rounded-xl border border-line" />
            <figcaption className="mt-2 text-xs text-muted">{hero.caption}</figcaption>
          </figure>
        ) : null}

        {item.summary ? (
          <>
            <Listen
              title={item.title ?? "This item"}
              summaryMd={[...item.summary.key_points, item.summary.summary_md].join("\n\n")}
            />

            {item.summary.key_points.length > 0 ? (
              <ul className="mb-8 space-y-2.5 rounded-xl border border-line bg-surface px-5 py-4">
                {item.summary.key_points.map((point) => (
                  <li key={point} className="flex gap-3 text-[15px] leading-relaxed">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="prose-reader">
              <Markdown>{item.summary.summary_md}</Markdown>
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
              Summarised by {item.summary.model}
              {item.summary.tokens_in && item.summary.tokens_out
                ? ` · ${item.summary.tokens_in.toLocaleString()} in / ${item.summary.tokens_out.toLocaleString()} out`
                : ""}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted">
            {item.status === "failed"
              ? "No summary was produced."
              : item.source_type === "research"
                ? "Researching. Searching the web and reading sources — this takes a minute or two."
                : "Reading it now..."}
          </p>
        )}

        {item.content ? <OriginalContent html={item.content.html} text={item.content.text} /> : null}
      </main>
      </PageTransition>
    </>
  );
}
