"use client";

import { useEffect } from "react";

/**
 * Registers the worker that makes the app installable and lets an already
 * opened summary be read with no connection. Dev is left alone: a service
 * worker caching a page you are editing is a debugging session of its own.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unregistered worker costs offline reading, nothing else.
      });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
