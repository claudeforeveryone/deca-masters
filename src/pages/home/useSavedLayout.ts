import type { User } from "@supabase/supabase-js";
import { useEffect, useRef, useState } from "react";
import { boardLayoutOf, saveBoardLayout } from "../../api/dashboard";
import { sameLayout, type BoardLayout } from "../../lib/board";

export type SaveState = "idle" | "saving" | "saved" | "error";

export function useSavedLayout(user: User) {
  const [layout, setLayout] = useState<BoardLayout>(() => boardLayoutOf(user));
  const [save, setSave] = useState<SaveState>("idle");
  const saved = useRef(layout);
  const pending = useRef<BoardLayout | null>(null);
  const [retry, setRetry] = useState(0);

  // Debounced: a burst of moves is one write.
  useEffect(() => {
    if (sameLayout(layout, saved.current)) {
      pending.current = null;
      return;
    }
    pending.current = layout;
    const t = window.setTimeout(() => {
      pending.current = null;
      setSave("saving");
      saveBoardLayout(layout).then(
        () => {
          saved.current = layout;
          setSave("saved");
        },
        () => setSave("error"),
      );
    }, 700);
    return () => window.clearTimeout(t);
  }, [layout, retry]);

  // A change made just before leaving the page (or hiding the tab) is still written, not dropped with the timer.
  useEffect(() => {
    function flush() {
      const l = pending.current;
      if (!l || sameLayout(l, saved.current)) return;
      pending.current = null;
      saveBoardLayout(l).then(
        () => {
          saved.current = l;
        },
        () => {},
      );
    }
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      flush();
    };
  }, []);

  return {
    layout,
    setLayout,
    save,
    retrySave: () => setRetry((n) => n + 1),
  };
}
