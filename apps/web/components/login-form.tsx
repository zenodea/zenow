"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // Read from the form, not from React state: a password manager fills the
    // field without firing onChange, so controlled state would still be empty.
    const passphrase = String(new FormData(event.currentTarget).get("passphrase") ?? "");
    if (!passphrase) {
      setError("Enter your passphrase");
      return;
    }

    setBusy(true);
    setError(null);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });

    if (response.ok) {
      router.replace("/");
      router.refresh();
      return;
    }

    const body = await response.json().catch(() => ({ error: "Login failed" }));
    setError(body.error ?? "Login failed");
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input
        type="password"
        name="passphrase"
        autoComplete="current-password"
        placeholder="Passphrase"
        autoFocus
        className="w-full rounded-full border border-line bg-surface px-4 py-2.5 text-sm outline-none placeholder:text-muted focus:border-accent"
      />
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-40"
      >
        {busy ? "Checking..." : "Sign in"}
      </button>
      {error ? <p className="pl-4 text-sm text-accent">{error}</p> : null}
    </form>
  );
}
