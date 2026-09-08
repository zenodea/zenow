"use client";

import { NeonAuthUIProvider } from "@neondatabase/auth/react/ui";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { authClient } from "@/lib/auth/client";

export function Providers({ children }: { children: ReactNode }) {
  const router = useRouter();

  // These must be wrapped, not passed as router.push / router.replace. Handing
  // over the bare references detaches them from the router instance and they
  // run before it is initialised, which throws "Router action dispatched
  // before initialization" while the provider is still setting up. The forms
  // then never get their javascript handlers and fall back to a native POST to
  // the page url, which looks exactly like sign-in doing nothing at all.
  return (
    <NeonAuthUIProvider
      authClient={authClient}
      navigate={(href) => router.push(href)}
      replace={(href) => router.replace(href)}
      onSessionChange={() => router.refresh()}
      social={{ providers: ["google"] }}
      redirectTo="/"
    >
      {children}
    </NeonAuthUIProvider>
  );
}
