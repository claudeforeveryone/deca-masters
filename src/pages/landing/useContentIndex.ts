import { useEffect, useState } from "react";
import { loadContentIndex, type ContentIndex } from "../../lib/content";

export type IndexState =
  | { status: "loading"; index: null }
  | { status: "ready"; index: ContentIndex }
  | { status: "error"; index: null };

/** The published content index (cached by lib/content). Sections show honest loading, empty and error states. */
export function useContentIndex(): IndexState {
  const [state, setState] = useState<IndexState>({
    status: "loading",
    index: null,
  });
  useEffect(() => {
    let live = true;
    loadContentIndex()
      .then((index) => live && setState({ status: "ready", index }))
      .catch(() => live && setState({ status: "error", index: null }));
    return () => {
      live = false;
    };
  }, []);
  return state;
}
