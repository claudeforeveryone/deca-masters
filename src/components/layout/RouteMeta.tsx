// Head tags for the current route (lib/seo routeMeta through lib/applyMeta). Event and deck pages need the content
// index for their names; it is read from the cache when present and loaded once otherwise.
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { applyMeta } from "../../lib/applyMeta";
import {
  loadContentIndex,
  peekContentIndex,
  type ContentIndex,
} from "../../lib/content";
import { routeMeta } from "../../lib/seo";

const NEEDS_INDEX = /^\/(events|roleplay|vocab)\/[^/]+\/?$/;

export function RouteMeta() {
  const { pathname } = useLocation();
  // Starts empty and reads the cache in an effect: a peek during the prerender would make every page embed the index.
  const [index, setIndex] = useState<ContentIndex | null>(null);
  const [failed, setFailed] = useState(false);
  const needsIndex = NEEDS_INDEX.test(pathname);

  useEffect(() => {
    if (!needsIndex || index) return;
    const cached = peekContentIndex();
    if (cached) {
      setIndex(cached);
      return;
    }
    let live = true;
    loadContentIndex().then(
      (i) => live && setIndex(i),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [needsIndex, index]);

  useEffect(() => {
    // An event or deck page waits for the index instead of briefly claiming "not found" (and noindex).
    if (needsIndex && !index && !failed) return;
    applyMeta(document, routeMeta(pathname, index));
  }, [pathname, index, needsIndex, failed]);

  return null;
}
