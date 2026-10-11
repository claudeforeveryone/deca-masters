// Browser-only app plumbing started once from main.tsx: the install prompt, outbound resource tracking and the
// offline-shell service worker. Each piece is a no-op where the browser cannot do it.
import { useSyncExternalStore } from "react";
import { track } from "../api/track";
import { createInstall, type Install } from "./install";
import { classifyOutbound } from "./outbound";

/** Created at import time so the one-off beforeinstallprompt event is never missed. */
export const install: Install | null =
  typeof window === "undefined"
    ? null
    : createInstall(window, (name, meta) => void track(name, null, meta));

const never = () => () => {};
export function useCanInstall(): boolean {
  return useSyncExternalStore(
    install ? install.subscribe : never,
    () => install?.available() ?? false,
    () => false,
  );
}

/**
 * resource_opened for every outbound https link a member opens (deca.org pages and PDFs, licensed sources), from one
 * listener instead of a call in each component. Sends no URL: only official/licensed, pdf/page, and the page's code.
 */
export function startOutboundTracking(doc: Document = document): () => void {
  const onClick = (e: MouseEvent) => {
    if (e.button > 1) return;
    const a = (e.target as Element | null)?.closest?.("a[href]");
    if (!(a instanceof HTMLAnchorElement)) return;
    const hit = classifyOutbound(a.href, location.pathname, location.origin);
    if (hit) void track("resource_opened", hit.code, hit.meta);
  };
  doc.addEventListener("click", onClick, true);
  doc.addEventListener("auxclick", onClick, true);
  return () => {
    doc.removeEventListener("click", onClick, true);
    doc.removeEventListener("auxclick", onClick, true);
  };
}

/** Production only: the dev server's modules must never be cached. */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  const go = () =>
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .catch(() => {
        // No service worker: the site works the same, just not offline.
      });
  if (document.readyState === "complete") go();
  else window.addEventListener("load", go, { once: true });
}
