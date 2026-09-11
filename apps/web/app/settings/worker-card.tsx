"use client";

import { useActionState } from "react";
import { provision, stop, type ActionState } from "./actions";
import type { SettingsView } from "@/lib/settings";

const STATUS: Record<SettingsView["workerStatus"], { label: string; className: string }> = {
  none: { label: "Not provisioned", className: "bg-line/70 text-muted" },
  provisioning: { label: "Provisioning", className: "bg-line/70 text-muted" },
  running: { label: "Ready", className: "bg-ok-soft text-ok" },
  stopped: { label: "Stopped", className: "bg-line/70 text-muted" },
  error: { label: "Error", className: "bg-accent-soft text-accent" },
};

export function WorkerCard({ settings }: { settings: SettingsView }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(provision, {});
  const status = STATUS[settings.workerStatus];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${status.className}`}>
          {status.label}
        </span>
        {settings.flyAppName ? <span className="text-xs text-muted">{settings.flyAppName}</span> : null}
      </div>

      {settings.workerError ? (
        <p className="rounded-lg border border-line bg-accent-soft px-3 py-2 text-sm text-accent">
          {settings.workerError}
        </p>
      ) : null}

      <form action={action}>
        <button
          type="submit"
          disabled={pending || !settings.llmKeyHint || !settings.flyTokenHint || !settings.flyAppName}
          className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
        >
          {pending ? "Provisioning…" : settings.workerStatus === "running" ? "Redeploy" : "Provision"}
        </button>
      </form>

      {!settings.llmKeyHint || !settings.flyTokenHint || !settings.flyAppName ? (
        <p className="text-xs text-muted">
          Add your OpenRouter key, Fly app name and Fly token above first.
        </p>
      ) : null}

      {state.ok ? <p className="text-sm text-muted">{state.ok}</p> : null}
      {state.error ? <p className="text-sm text-accent">{state.error}</p> : null}

      {settings.workerStatus === "running" ? (
        <form action={stop}>
          <button type="submit" className="text-xs text-muted underline hover:text-accent">
            Stop and destroy the machine
          </button>
        </form>
      ) : null}
    </div>
  );
}
