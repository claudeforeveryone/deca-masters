import { useLayoutEffect } from "react";

/**
 * Shown while a page's code chunk or the session loads. Says what is happening; the shell stays in place.
 * While it shows, the footer is hidden (html[data-route-loading], see index.css): otherwise the footer sits under
 * this short placeholder and jumps down when the page arrives, which is most of the page's layout shift.
 */
export function RouteFallback({ label = "Loading" }: { label?: string }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.routeLoading = "";
    return () => {
      delete root.dataset.routeLoading;
    };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className="grid min-h-[40vh] place-items-center"
    >
      <div className="grid justify-items-center gap-3">
        <div aria-hidden="true" className="h-0.5 w-40 overflow-hidden bg-line">
          <div className="h-full w-1/3 animate-[route-load_1.1s_var(--ease-in-out)_infinite] bg-accent" />
        </div>
        <p className="font-mono text-sm text-ink-3">{label}</p>
      </div>
    </div>
  );
}
