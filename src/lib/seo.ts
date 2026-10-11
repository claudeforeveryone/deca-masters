// Search metadata for every route: titles, descriptions, canonical URLs, robots rules, Open Graph and Twitter cards,
// JSON-LD, the sitemap and robots.txt. One source for both sides: the build-time prerender writes it into each page's
// <head> (scripts/prerender.mjs, through src/entry-server.tsx), and RouteMeta keeps the document in step when the app
// navigates. Pure string building, safe in Node and the browser.
import type { ContentIndex } from "./content";

export const SITE_URL = (
  (import.meta.env?.VITE_SITE_URL as string | undefined) ||
  "https://deca-masters.vercel.app"
).replace(/\/+$/, "");
export const SITE_NAME = "DECA Masters";
/** 1200x630, rendered from the landing's poster (public/og/deca-masters.png). */
export const OG_IMAGE = `${SITE_URL}/og/deca-masters.png`;
const OG_ALT =
  "DECA Masters: a faceted metal structure lit through its seams on a navy stage, with the words Walk in ready.";
/** Effective date of the current Terms of Use and Privacy Policy. */
export const POLICY_DATE = "2026-10-11";

export type Robots = "index,follow" | "noindex,follow" | "noindex,nofollow";
export type JsonLd = Record<string, unknown> & { "@type": string };
export type RouteMeta = {
  path: string;
  title: string;
  description: string;
  canonical: string;
  robots: Robots;
  jsonLd: JsonLd[];
};

const DEFAULT_DESCRIPTION =
  "Cluster-exam drills, role-play prep and vocab for DECA members, built around each event's real format. A free, independent study tool made by students, not affiliated with DECA Inc.";

const titled = (t: string) => `${t} | ${SITE_NAME}`;

type Page = { title: string; description: string; robots: Robots };
const members = (title: string): Page => ({
  title: titled(title),
  description: DEFAULT_DESCRIPTION,
  robots: "noindex,nofollow",
});

/** Static pages. Members-only pages are listed too, so a browser tab still says where you are. */
const PAGES: Record<string, Page> = {
  "/": {
    title: "DECA Masters: practise DECA cluster exams, role plays and vocab",
    description: DEFAULT_DESCRIPTION,
    robots: "index,follow",
  },
  "/events": {
    title: titled("DECA events by cluster: formats and timings"),
    description:
      "Every high school DECA competitive event by cluster, with its format, prep and judge time, team size and cluster exam, checked against deca.org.",
    robots: "index,follow",
  },
  "/roleplay": {
    title: titled("Role-play trainer"),
    description:
      "Practise DECA role plays and case studies on the real clock: prep time, time with the judge and the performance indicators to cover, with links to DECA's own samples.",
    robots: "index,follow",
  },
  "/vocab": {
    title: titled("Vocab flashcards"),
    description:
      "Flashcards for each DECA cluster exam's vocabulary. Every term comes from an openly licensed source and is credited on its card. Terms you miss come back sooner.",
    robots: "index,follow",
  },
  "/credits": {
    title: titled("Credits and sources"),
    description:
      "Where every practice question and vocab term on DECA Masters comes from, with its licence and attribution.",
    robots: "index,follow",
  },
  "/terms": {
    title: titled("Terms of Use"),
    description:
      "The rules for using DECA Masters, a free and independent DECA study tool made by students. Plain language, not lawyer-reviewed.",
    robots: "index,follow",
  },
  "/privacy": {
    title: titled("Privacy Policy"),
    description:
      "What DECA Masters collects, why, who can see it, how long it is kept and how to have it deleted. Written for students, including Ontario minors.",
    robots: "index,follow",
  },
  "/signup": {
    title: titled("Create an account"),
    description:
      "Create a free DECA Masters account to save practice runs, vocab progress and role-play sessions.",
    robots: "index,follow",
  },
  // Which events it shows lives in the query string, so there is no one page to index.
  "/events/compare": {
    title: titled("Compare events"),
    description:
      "Compare up to three DECA events side by side: format, prep and judge time, team size and cluster exam.",
    robots: "noindex,follow",
  },
  "/login": {
    title: titled("Sign in"),
    description: "Sign in to DECA Masters.",
    robots: "noindex,follow",
  },
  "/reset": {
    title: titled("Reset your password"),
    description: "Get a link to set a new DECA Masters password.",
    robots: "noindex,follow",
  },
  "/reset/update": members("Set a new password"),
  "/onboarding": members("Set up your profile"),
  "/practice": members("Practice exams"),
  "/practice/run": members("Exam run"),
  "/progress": members("Progress"),
  "/leaderboard": members("Leaderboard"),
  "/me": members("Your profile"),
  "/me/settings": members("Settings"),
  "/owner": members("Owner console"),
};

const NAMED_BY_CONTENT = /^\/(events|roleplay|vocab)\/[^/]+\/?$/;

/** True when a path's head names an event or a deck, so it has to wait for the content index (static pages never do). */
export function metaNeedsIndex(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : "/";
  return NAMED_BY_CONTENT.test(path) && !(path in PAGES);
}

/** Paths a crawler may fetch and the sitemap lists: the static public pages plus one page per published event. */
export function publicPaths(index: ContentIndex | null | undefined): string[] {
  const statics = Object.entries(PAGES)
    .filter(([, p]) => p.robots === "index,follow")
    .map(([path]) => path);
  const events = (index?.events ?? []).map((e) => `/events/${e.code}`).sort();
  return [...statics, ...events];
}

function crumbs(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${SITE_URL}${c.path}`,
    })),
  };
}

function webPage(path: string, title: string, description: string): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: title,
    description,
    url: `${SITE_URL}${path}`,
    inLanguage: "en-CA",
    isPartOf: { "@type": "WebSite", name: SITE_NAME, url: `${SITE_URL}/` },
  };
}

/** Cuts a description to about 160 characters at a word boundary. */
function clip(s: string, max = 160): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, t.lastIndexOf(" ", max - 3)).replace(/[,;:.]$/, "")}...`;
}

/** Everything the <head> should say for `pathname`. Event and deck pages read the content index when given. */
export function routeMeta(
  pathname: string,
  index?: ContentIndex | null,
): RouteMeta {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") || "/" : "/";
  const base = { path, canonical: `${SITE_URL}${path}` };

  const page = PAGES[path];
  if (page) {
    const jsonLd: JsonLd[] =
      path === "/"
        ? [
            {
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_NAME,
              url: `${SITE_URL}/`,
              description: page.description,
              inLanguage: "en-CA",
              creator: [
                { "@type": "Person", name: "Joseph" },
                { "@type": "Person", name: "Kaden" },
              ],
            },
          ]
        : page.robots === "index,follow"
          ? [webPage(path, page.title, page.description)]
          : [];
    return { ...base, ...page, jsonLd };
  }

  const byCode = /^\/(events|roleplay)\/([^/]+)$/.exec(path);
  if (byCode) {
    const [, area, code] = byCode;
    const e = index?.events.find((x) => x.code === code);
    const trainer = area === "roleplay";
    if (e) {
      const title = titled(
        trainer
          ? `${e.name} (${e.code}) role-play trainer`
          : `${e.name} (${e.code})`,
      );
      const description = clip(
        trainer
          ? `Practise ${e.name} on its real clock, with links to DECA's own sample role plays.`
          : e.summary,
      );
      const parent = trainer
        ? { name: "Role-play trainer", path: "/roleplay" }
        : { name: "Events", path: "/events" };
      return {
        ...base,
        title,
        description,
        robots: "index,follow",
        jsonLd: [
          webPage(path, title, description),
          crumbs([parent, { name: e.name, path }]),
        ],
      };
    }
    return {
      ...base,
      title: titled(trainer ? "Role-play trainer" : "Event not found"),
      description: DEFAULT_DESCRIPTION,
      robots: "noindex,follow",
      jsonLd: [],
    };
  }

  const deck = /^\/vocab\/([^/]+)$/.exec(path);
  const d = deck ? index?.vocab.find((v) => v.slug === deck[1]) : undefined;
  if (d) {
    const title = titled(d.title);
    const description = clip(
      `${d.title} as flashcards for DECA's cluster exams, each term credited to its openly licensed source.`,
    );
    return {
      ...base,
      title,
      description,
      robots: "index,follow",
      jsonLd: [
        webPage(path, title, description),
        crumbs([
          { name: "Vocab", path: "/vocab" },
          { name: d.title, path },
        ]),
      ],
    };
  }

  if (/^\/practice\/review\//.test(path))
    return { ...base, ...members("Run review"), jsonLd: [] };

  return {
    ...base,
    title: titled("Page not found"),
    description: DEFAULT_DESCRIPTION,
    robots: "noindex,follow",
    jsonLd: [],
  };
}

const ATTR: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export const escapeAttr = (s: string) => s.replace(/[&<>"']/g, (c) => ATTR[c]);
/** JSON for a <script> body: a "<" could close the script early, so it is written as its escape sequence. */
export const scriptJson = (v: unknown) =>
  JSON.stringify(v).replace(/</g, "\\u003c");

/** The head tags for a page, as HTML (the prerender puts them in place of the shell's defaults). */
export function headTags(m: RouteMeta): string {
  const meta = (attr: "name" | "property", key: string, value: string) =>
    `<meta ${attr}="${key}" content="${escapeAttr(value)}">`;
  return [
    `<title>${escapeAttr(m.title)}</title>`,
    meta("name", "description", m.description),
    meta("name", "robots", m.robots),
    `<link rel="canonical" href="${escapeAttr(m.canonical)}">`,
    meta("property", "og:type", "website"),
    meta("property", "og:site_name", SITE_NAME),
    meta("property", "og:locale", "en_CA"),
    meta("property", "og:title", m.title),
    meta("property", "og:description", m.description),
    meta("property", "og:url", m.canonical),
    meta("property", "og:image", OG_IMAGE),
    meta("property", "og:image:width", "1200"),
    meta("property", "og:image:height", "630"),
    meta("property", "og:image:alt", OG_ALT),
    meta("name", "twitter:card", "summary_large_image"),
    meta("name", "twitter:title", m.title),
    meta("name", "twitter:description", m.description),
    meta("name", "twitter:image", OG_IMAGE),
    meta("name", "twitter:image:alt", OG_ALT),
    ...m.jsonLd.map(
      (j) => `<script type="application/ld+json">${scriptJson(j)}</script>`,
    ),
  ].join("");
}

export function sitemapXml(paths: string[]): string {
  const urls = paths
    .map((p) => `<url><loc>${escapeAttr(`${SITE_URL}${p}`)}</loc></url>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`;
}

/** Members-only areas, the owner console and the dev gallery stay out of crawls; everything else is open. */
export function robotsTxt(): string {
  return [
    "User-agent: *",
    "Disallow: /owner",
    "Disallow: /me",
    "Disallow: /onboarding",
    "Disallow: /practice/run",
    "Disallow: /practice/review/",
    "Disallow: /reset/update",
    "Disallow: /dev/",
    "",
    `Sitemap: ${SITE_URL}/sitemap.xml`,
    "",
  ].join("\n");
}
