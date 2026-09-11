"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

const FIELD =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none placeholder:text-muted focus:border-accent";
const BUTTON =
  "rounded-full bg-accent px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40";

function Card({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 mb-4 text-sm text-muted">{description}</p>
      {children}
    </section>
  );
}

/** Everything here posts to our own /api/auth/[...path] handler. */
async function post(path: string, body: unknown) {
  const response = await fetch(`/api/auth/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return null;
  const parsed = (await response.json().catch(() => null)) as { message?: string } | null;
  return parsed?.message ?? `That failed (${response.status}).`;
}

/** The name is rendered from the session on the server, so there is nothing to load. */
export function NameForm({ name }: { name: string }) {
  const router = useRouter();
  const [state, setState] = useState<{ busy: boolean; note?: string; error?: string }>({ busy: false });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get("name") ?? "").trim();
    if (!value) {
      setState({ busy: false, error: "Enter a name." });
      return;
    }

    setState({ busy: true });
    const error = await post("update-user", { name: value });
    setState({ busy: false, ...(error ? { error } : { note: "Saved." }) });
    if (!error) router.refresh();
  }

  return (
    <Card title="Name" description="How you are shown in the app.">
      <form onSubmit={onSubmit} className="flex flex-wrap items-center gap-3">
        <input name="name" defaultValue={name} className={`${FIELD} min-w-0 flex-1`} />
        <button type="submit" disabled={state.busy} className={BUTTON}>
          {state.busy ? "Saving…" : "Save"}
        </button>
        {state.note ? <span className="text-sm text-muted">{state.note}</span> : null}
        {state.error ? <span className="text-sm text-accent">{state.error}</span> : null}
      </form>
    </Card>
  );
}

export function PasswordForm() {
  const [state, setState] = useState<{ busy: boolean; note?: string; error?: string }>({ busy: false });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const currentPassword = String(data.get("currentPassword") ?? "");
    const newPassword = String(data.get("newPassword") ?? "");

    if (newPassword.length < 8) {
      setState({ busy: false, error: "Use at least 8 characters." });
      return;
    }

    setState({ busy: true });
    // Other sessions are dropped: changing a password usually means you no
    // longer want whatever else was signed in.
    const error = await post("change-password", { currentPassword, newPassword, revokeOtherSessions: true });
    setState({ busy: false, ...(error ? { error } : { note: "Password changed. Other devices signed out." }) });
    if (!error) form.reset();
  }

  return (
    <Card title="Password" description="Changing it signs out your other devices.">
      <form onSubmit={onSubmit} className="space-y-3">
        <input name="currentPassword" type="password" autoComplete="current-password" placeholder="Current password" className={FIELD} />
        <input name="newPassword" type="password" autoComplete="new-password" placeholder="New password" className={FIELD} />
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={state.busy} className={BUTTON}>
            {state.busy ? "Changing…" : "Change password"}
          </button>
          {state.note ? <span className="text-sm text-muted">{state.note}</span> : null}
          {state.error ? <span className="text-sm text-accent">{state.error}</span> : null}
        </div>
      </form>
    </Card>
  );
}

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await post("sign-out", {});
        router.replace("/auth/sign-in");
        router.refresh();
      }}
      className="rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition hover:border-accent hover:text-accent disabled:opacity-40"
    >
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
