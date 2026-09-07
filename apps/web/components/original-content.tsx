import DOMPurify from "isomorphic-dompurify";

/** Sanitised on the server; the stored html came from a third-party page. */
export function OriginalContent({ html, text }: { html: string | null; text: string }) {
  const clean = html ? DOMPurify.sanitize(html, { FORBID_TAGS: ["style", "form", "input"] }) : null;

  return (
    <details className="mt-14 border-t border-line pt-6">
      <summary className="cursor-pointer text-xs tracking-[0.12em] text-muted uppercase select-none hover:text-ink">
        Original content
      </summary>
      <div className="prose-reader mt-6">
        {clean ? <div dangerouslySetInnerHTML={{ __html: clean }} /> : <p className="whitespace-pre-wrap">{text}</p>}
      </div>
    </details>
  );
}
