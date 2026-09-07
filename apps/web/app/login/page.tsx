import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/session";

export default async function LoginPage() {
  if ((await getSession()).loggedIn) redirect("/");

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <h1 className="mb-1 text-3xl font-bold tracking-tight">
        Zenow<span className="text-accent">.</span>
      </h1>
      <p className="mb-8 text-sm text-muted">Save a link. Get the substance back.</p>
      <LoginForm />
    </main>
  );
}
