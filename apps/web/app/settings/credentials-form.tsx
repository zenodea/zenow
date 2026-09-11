"use client";

import { useActionState } from "react";
import { saveCredentials, type ActionState } from "./actions";
import { SecretField } from "./secret-field";
import type { SettingsView } from "@/lib/settings";

const MODELS = [
  { slug: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna — default; best per pound ($0.20/$1.20 per Mtok)" },
  { slug: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite — cheapest ($0.10/$0.40)" },
  { slug: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5 ($1/$5)" },
  { slug: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5 — best quality ($3/$15)" },
];

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent";

export function CredentialsForm({ settings }: { settings: SettingsView }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(saveCredentials, {});

  return (
    <form action={action} className="space-y-6">
      <div>
        <label htmlFor="llmKey" className="mb-1 block text-sm font-medium">
          OpenRouter key
        </label>
        <p className="mb-2 text-xs text-muted">
          Summaries are billed to your own OpenRouter account.{" "}
          <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="text-accent underline">
            Get a key
          </a>
          .
        </p>
        <SecretField name="llmKey" hint={settings.llmKeyHint} placeholder="sk-or-v1-…" className={FIELD} />
      </div>

      <div>
        <label htmlFor="llmModel" className="mb-1 block text-sm font-medium">
          Model
        </label>
        <select id="llmModel" name="llmModel" defaultValue={settings.llmModel} className={FIELD}>
          {MODELS.map((model) => (
            <option key={model.slug} value={model.slug}>
              {model.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="flyAppName" className="mb-1 block text-sm font-medium">
          Fly app name
        </label>
        <p className="mb-2 text-xs text-muted">
          Zenow creates this app for you if your token is org-scoped. An{" "}
          <strong className="font-semibold text-ink">app-scoped</strong> token is safer but can only
          manage an app that already exists, so with one of those, run
          <code className="mx-1 rounded bg-surface px-1 py-0.5 text-[11px]">
            fly apps create zenow-worker-yourname
          </code>
          first.
        </p>
        <input
          id="flyAppName"
          name="flyAppName"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          defaultValue={settings.flyAppName ?? ""}
          placeholder="zenow-worker-yourname"
          className={FIELD}
        />
      </div>

      <div>
        <label htmlFor="flyToken" className="mb-1 block text-sm font-medium">
          Fly deploy token
        </label>
        <p className="mb-2 text-xs text-muted">
          Scoped to that one app, so it can never touch the rest of your account:
          <code className="mx-1 rounded bg-surface px-1 py-0.5 text-[11px]">
            fly tokens create deploy -a zenow-worker-yourname
          </code>
          . Checked against your app when you save.
        </p>
        <SecretField
          name="flyToken"
          hint={settings.flyTokenHint}
          placeholder="FlyV1 fm2_…"
          multiline
          className={`${FIELD} font-mono text-[11px] break-all`}
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Saving…" : "Save"}
        </button>
        {state.ok ? <span className="text-sm text-muted">{state.ok}</span> : null}
        {state.error ? <span className="text-sm text-accent">{state.error}</span> : null}
      </div>
    </form>
  );
}
