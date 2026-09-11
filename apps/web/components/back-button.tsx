import Link from "next/link";

/**
 * Replaces the "My list" link that sat above the title. A back control belongs
 * where your thumb is, not at the top of a page you have scrolled away from,
 * and it comes up from the bottom edge so it reads as part of this screen.
 */
export function BackButton() {
  return (
    <Link
      href="/"
      transitionTypes={["nav-out"]}
      aria-label="Back to your list"
      title="Back to your list"
      className="rise fixed right-5 bottom-5 z-20 grid size-12 place-items-center rounded-full bg-accent text-white shadow-lg transition hover:opacity-90"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
        aria-hidden
      >
        <path d="M19 12H5m0 0 6-6m-6 6 6 6" />
      </svg>
    </Link>
  );
}
