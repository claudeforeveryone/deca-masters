import { useEffect, useState, type ReactNode } from "react";

/**
 * Whether an element is on the screen. Reads true until the browser says otherwise (and where IntersectionObserver
 * is missing), so anything shown "while it is off the screen" never flashes on load.
 */
export function useOnScreen<T extends Element>() {
  // A callback ref held in state, so the watch starts whenever the element mounts (a page may show a loading
  // state first).
  const [el, ref] = useState<T | null>(null);
  const [onScreen, setOnScreen] = useState(true);
  useEffect(() => {
    if (!el || typeof IntersectionObserver === "undefined") return;
    const seen = new IntersectionObserver(([entry]) =>
      setOnScreen(entry?.isIntersecting ?? true),
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [el]);
  return [ref, onScreen] as const;
}

/**
 * A slim bar pinned above the bottom tab bar (phones and tablets; gone on the desktop layout). For a
 * page whose main action sits under a long form: show it while that action is off the screen, with a one-line
 * summary and the same button.
 */
export function PhoneActionBar({
  show,
  children,
}: {
  show: boolean;
  children: ReactNode;
}) {
  if (!show) return null;
  return (
    <div className="fixed inset-x-0 bottom-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))] z-10 border-t border-line bg-surface lg:hidden">
      <div className="shell flex items-center gap-3 py-2.5">{children}</div>
    </div>
  );
}
