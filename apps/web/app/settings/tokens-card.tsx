"use client";

import { useActionState, useEffect, useState } from "react";
import { mintToken, revoke, type TokenActionState } from "./actions";
import type { TokenView } from "@/lib/tokens";

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent";

function when(date: Date | null): string {
  if (!date) return "never used";
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Copies to the clipboard, and says so, because a click with no feedback
 *  leaves you wondering whether the one copy you get actually worked. */
function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
        } catch {
          setCopied(false);
        }
      }}
      className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium transition hover:border-accent hover:text-accent"
    >
      {copied ? "Copied" : label}
    </button>
  );
}

export function TokensCard({ tokens }: { tokens: TokenView[] }) {
  const [state, action, pending] = useActionState<TokenActionState, FormData>(mintToken, {});

  return (
    <div className="space-y-5">
      {state.raw ? (
        <div className="space-y-3 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3">
          <p className="text-sm font-medium text-accent">
            Copy this now — it is stored only as a hash, so it cannot be shown again.
          </p>

          <div className="flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded bg-surface px-2 py-1 font-mono text-[11px]">
              {state.raw}
            </code>
            <CopyButton value={state.raw} label="Copy token" />
          </div>

          <p className="text-xs text-muted">
            Paste it into the extension&apos;s options.
          </p>
        </div>
      ) : null}

      {tokens.length ? (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {tokens.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{token.name}</p>
                <p className="text-xs text-muted">
                  Added {when(token.createdAt)} · {token.lastUsed ? `last used ${when(token.lastUsed)}` : "never used"}
                </p>
              </div>
              <form action={revoke}>
                <input type="hidden" name="id" value={token.id} />
                <button
                  type="submit"
                  className="shrink-0 text-xs text-muted underline transition hover:text-accent"
                >
                  Revoke
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">
          No tokens yet.
        </p>
      )}

      <form action={action} className="flex items-end gap-3">
        <div className="flex-1">
          <label htmlFor="tokenName" className="mb-1 block text-sm font-medium">
            Name
          </label>
          <input
            id="tokenName"
            name="name"
            maxLength={40}
            autoComplete="off"
            spellCheck={false}
            placeholder="firefox"
            className={FIELD}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Creating…" : "Create token"}
        </button>
      </form>

      {state.error ? <p className="text-sm text-accent">{state.error}</p> : null}
    </div>
  );
}
