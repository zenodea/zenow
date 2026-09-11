export const metadata = { title: "Offline — Zenow" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col items-center justify-center px-6 text-center">
      <p className="mb-2 text-lg font-semibold">You are offline</p>
      <p className="max-w-sm text-sm text-muted">
        Anything you have already opened is still readable. Saving a new link needs a connection.
      </p>
    </main>
  );
}
