import { AuthView } from "@neondatabase/auth/react/ui";

/** sign-in, sign-up, forgot-password and the oauth callback all live here. */
export default async function AuthPage({ params }: { params: Promise<{ path: string }> }) {
  const { path } = await params;

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">
        Zenow<span className="text-accent">.</span>
      </h1>
      <p className="mb-8 text-sm text-muted">Save a link. Get the substance back.</p>
      <AuthView path={path} />
    </main>
  );
}
