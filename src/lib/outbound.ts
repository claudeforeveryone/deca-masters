// Which outbound links count as `resource_opened` (deca_track), and what small, enum-only metadata goes with them.
// No URL, title or text is ever sent: only whether the resource is DECA's own or an openly licensed source, whether
// it is a PDF, and the event code or deck the page was about. Pure, so the shell's click listener stays thin.
import { isOfficialDecaUrl } from "../../content/validate.mjs";
import type { TrackMeta } from "./analytics";

const EVENT_PAGE = /^\/(?:events|roleplay)\/([A-Z][A-Z0-9]{1,6})\/?$/;
const DECK_PAGE = /^\/(?:vocab|practice)\/([a-z][a-z-]{2,39})\/?$/;

export function classifyOutbound(
  href: string,
  pathname: string,
  origin: string,
): { code: string | null; meta: TrackMeta } | null {
  let url: URL;
  try {
    url = new URL(href, origin);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.origin === origin) return null;
  const code =
    EVENT_PAGE.exec(pathname)?.[1] ?? DECK_PAGE.exec(pathname)?.[1] ?? null;
  return {
    code,
    meta: {
      source: isOfficialDecaUrl(url.href) ? "official" : "licensed",
      kind: /\.pdf$/i.test(url.pathname) ? "pdf" : "page",
    },
  };
}
