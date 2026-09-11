import Link from "next/link";
import { getSession } from "@/lib/auth/server";

/**
 * Rendered on the server from the session we already have.
 *
 * It used to use Neon Auth's <UserButton>, a client component that fetches the
 * session itself and shows a skeleton until it arrives -- so every navigation
 * flashed a placeholder in the header for something the server already knew.
 *
 * The width is fixed here rather than per page. When the header inherited each
 * page's own max-width the wordmark jumped sideways between the list and
 * settings, which read as the layout shifting under you.
 */
export async function Header() {
  const { data: session } = await getSession();
  const user = session?.user;
  const initials = (user?.name ?? user?.email ?? "?")
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Zenow<span className="text-accent">.</span>
        </Link>

        <nav className="flex items-center gap-2">
          <Link
            href="/settings"
            title="Your OpenRouter and Fly tokens"
            className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs font-medium text-muted transition hover:border-ink hover:text-ink"
          >
            <KeyIcon />
            Tokens
          </Link>

          <Link
            href="/account/settings"
            title={user?.email ?? "Account"}
            className="flex items-center gap-2 rounded-full border border-line py-1 pr-3 pl-1 text-xs font-medium text-muted transition hover:border-ink hover:text-ink"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-line text-[10px] font-semibold text-ink">
              {initials}
            </span>
            {user?.name ?? "Account"}
          </Link>
        </nav>
      </div>
    </header>
  );
}

function KeyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3 21 2m-4 4 3 3m-6-6 3 3" strokeLinecap="round" />
    </svg>
  );
}
