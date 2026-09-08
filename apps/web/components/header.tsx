import Link from "next/link";
import { OrganizationSwitcher, UserButton } from "@neondatabase/auth/react/ui";

export function Header({ narrow = false }: { narrow?: boolean }) {
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur">
      <div className={`mx-auto flex items-center justify-between px-6 py-3 ${narrow ? "max-w-2xl" : "max-w-6xl"}`}>
        <Link href="/" className="text-lg font-bold tracking-tight">
          Zenow<span className="text-accent">.</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link href="/settings" className="text-xs text-muted hover:text-ink">
            Settings
          </Link>
          <OrganizationSwitcher size="sm" />
          <UserButton size="sm" />
        </div>
      </div>
    </header>
  );
}
