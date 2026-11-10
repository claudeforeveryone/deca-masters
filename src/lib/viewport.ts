import { useEffect, useRef } from "react";

/**
 * True on a phone-width screen (below the `sm` breakpoint). False where matchMedia is missing, so the build-time
 * prerender and tests get the desktop behaviour.
 */
export function isPhoneWidth(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 639px)").matches
  );
}

/**
 * A ref for the root of a study session. On a phone the session opens under a page header, so when it mounts it is
 * brought up under the top bar (the page's scroll padding clears the bar) and the first question sits on the screen.
 */
export function usePhoneFocus<T extends Element>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    if (isPhoneWidth()) ref.current?.scrollIntoView?.({ block: "start" });
  }, []);
  return ref;
}
