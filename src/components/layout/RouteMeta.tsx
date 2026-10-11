// Head tags for the current route (lib/seo routeMeta through lib/applyMeta). Event and deck pages need the content
// index for their names; it is read from the cache when present and loaded once otherwise.
import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { applyMeta } from "../../lib/applyMeta";
import { loadContentIndex, peekContentIndex } from "../../lib/content";
import { routeMeta } from "../../lib/seo";

const NEEDS_INDEX = /^\/(events|roleplay|vocab)\/[^/]+\/?$/;

export function RouteMeta() {
  const { pathname } = useLocation();
  const [index, setIndex] = useState(peekContentIndex);
  const needsIndex = NEEDS_INDEX.test(pathname);

  useEffect(() => {
    if (!needsIndex || index) return;
    let live = true;
    loadContentIndex().then(
      (i) => live && setIndex(i),
      () => {
        // No index: the generic title stays.
      },
    );
    return () => {
      live = false;
    };
  }, [needsIndex, index]);

  useEffect(() => {
    applyMeta(document, routeMeta(pathname, index));
  }, [pathname, index]);

  return null;
}
