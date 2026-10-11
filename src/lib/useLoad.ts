import { useCallback, useEffect, useState, type DependencyList } from "react";

export type Load<T> = {
  /** "loading" also while reloading; `data` keeps the last good value meanwhile. */
  status: "loading" | "ready" | "error";
  data: T | undefined;
  /** Copy safe to show (ApiError messages already are). */
  error: string | null;
  reload: () => void;
  /** Replaces the data in place after a successful write, without a refetch. */
  set: (next: T | ((prev: T | undefined) => T)) => void;
};

/**
 * Runs an async read when the component mounts (and when `deps` change), with a retry. A response that arrives after
 * the component unmounted or after a newer request started is dropped.
 */
export function useLoad<T>(
  fn: () => Promise<T>,
  deps: DependencyList = [],
): Load<T> {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{
    status: Load<T>["status"];
    data: T | undefined;
    error: string | null;
  }>({ status: "loading", data: undefined, error: null });

  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, status: "loading", error: null }));
    Promise.resolve()
      .then(fn)
      .then(
        (data) => {
          if (live) setState({ status: "ready", data, error: null });
        },
        (e: unknown) => {
          if (live)
            setState((s) => ({
              ...s,
              status: "error",
              error:
                e instanceof Error && e.message
                  ? e.message
                  : "Something went wrong.",
            }));
        },
      );
    return () => {
      live = false;
    };
    // fn is recreated each render; deps decide when it runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const set = useCallback<Load<T>["set"]>((next) => {
    setState((s) => ({
      status: "ready",
      error: null,
      data:
        typeof next === "function"
          ? (next as (prev: T | undefined) => T)(s.data)
          : next,
    }));
  }, []);

  return { ...state, reload, set };
}
