/** Shown while a page's code chunk or the session loads. Says what is happening; the shell stays in place. */
export function RouteFallback({ label = "Loading" }: { label?: string }) {
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
