// Keeps <head> in step with the route as the app navigates: the same tags the prerender writes (lib/seo headTags),
// updated in place so a shared link or a crawler that runs JavaScript sees the page it is on.
import { OG_IMAGE, SITE_NAME, type RouteMeta } from "./seo";

function upsert(
  doc: Document,
  selector: string,
  create: () => HTMLElement,
  attr: string,
  value: string,
) {
  let el = doc.head.querySelector(selector);
  if (!el) {
    el = create();
    doc.head.appendChild(el);
  }
  el.setAttribute(attr, value);
}

const meta = (doc: Document, kind: "name" | "property", key: string) => () => {
  const el = doc.createElement("meta");
  el.setAttribute(kind, key);
  return el;
};

export function applyMeta(doc: Document, m: RouteMeta): void {
  doc.title = m.title;
  const set = (kind: "name" | "property", key: string, value: string) =>
    upsert(
      doc,
      `meta[${kind}="${key}"]`,
      meta(doc, kind, key),
      "content",
      value,
    );
  set("name", "description", m.description);
  set("name", "robots", m.robots);
  set("property", "og:type", "website");
  set("property", "og:site_name", SITE_NAME);
  set("property", "og:title", m.title);
  set("property", "og:description", m.description);
  set("property", "og:url", m.canonical);
  set("property", "og:image", OG_IMAGE);
  set("name", "twitter:card", "summary_large_image");
  set("name", "twitter:title", m.title);
  set("name", "twitter:description", m.description);
  upsert(
    doc,
    'link[rel="canonical"]',
    () => {
      const el = doc.createElement("link");
      el.rel = "canonical";
      return el;
    },
    "href",
    m.canonical,
  );
  for (const old of doc.head.querySelectorAll(
    'script[type="application/ld+json"]',
  ))
    old.remove();
  for (const j of m.jsonLd) {
    const el = doc.createElement("script");
    el.type = "application/ld+json";
    el.textContent = JSON.stringify(j);
    doc.head.appendChild(el);
  }
}
