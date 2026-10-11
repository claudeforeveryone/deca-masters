import { useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * useSearchParams for pages that keep their state in the URL and write it from click handlers. The router renders a
 * navigation in a transition, so a second click can land before the first one has rendered; a handler that read the
 * rendered params would build on the old URL and undo the first click (tick Compare on two events quickly and only
 * the second stays). Handlers read with `read()`, which includes writes the router has not rendered yet.
 */
export function useLiveSearchParams() {
  const [params, setParams] = useSearchParams();
  // Writes sent but not rendered yet, oldest first.
  const pending = useRef<string[]>([]);
  const seen = useRef(params.toString());
  const now = params.toString();
  if (now !== seen.current) {
    seen.current = now;
    // Our own write has rendered: drop it and anything older. Anything else is the URL moving on its own (back,
    // forward, a link), which wins over writes still in flight.
    const at = pending.current.indexOf(now);
    pending.current = at >= 0 ? pending.current.slice(at + 1) : [];
  }

  const read = useCallback(
    () => new URLSearchParams(pending.current.at(-1) ?? seen.current),
    [],
  );
  const setRef = useRef(setParams);
  setRef.current = setParams;
  const write = useCallback((next: URLSearchParams) => {
    pending.current.push(next.toString());
    setRef.current(next, { replace: true, preventScrollReset: true });
  }, []);

  return { params, read, write };
}
