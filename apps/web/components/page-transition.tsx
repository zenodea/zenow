import { ViewTransition, type ReactNode } from "react";

/**
 * Depth, not direction: going deeper pushes in, coming back pulls out.
 *
 * The wrapper has to live in each page rather than the layout -- layouts
 * persist across navigation, so enter and exit never fire there.
 *
 * default: "none" means anything untagged (browser back/forward, a refresh,
 * a Suspense reveal) does not animate. Only links that say which way they go
 * get an animation.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <ViewTransition
      enter={{ "nav-in": "nav-in", "nav-out": "nav-out", default: "none" }}
      exit={{ "nav-in": "nav-in", "nav-out": "nav-out", default: "none" }}
      default="none"
    >
      {children}
    </ViewTransition>
  );
}
