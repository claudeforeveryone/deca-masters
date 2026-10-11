import { describe, expect, it } from "vitest";
import type { ContentIndex, EventItem } from "./content";
import {
  SITE_URL,
  headTags,
  publicPaths,
  robotsTxt,
  routeMeta,
  sitemapXml,
} from "./seo";

const event = (code: string, name: string, summary: string): EventItem => ({
  code,
  name,
  category: "Individual Series",
  cluster: "marketing",
  exam: "marketing",
  components: ["exam", "roleplay"],
  teamSize: "1",
  summary,
  officialUrl: `https://www.deca.org/compete/${code.toLowerCase()}`,
  verifiedAt: "2026-10-11",
  notes: null,
});

const index = {
  season: "2026-2027",
  source: null,
  disclaimer: null,
  events: [
    event("PMK", "Principles of Marketing", "You play a marketing employee & answer a manager's <questions>."),
    event("ACT", "Accounting Applications Series", "Solo role-plays with financial statements."),
  ],
  exams: [],
  vocab: [
    { slug: "marketing", title: "Marketing terms", status: "sourced", placeholderNote: null, terms: 80 },
  ],
  roleplays: [],
  officialSamples: true,
} as unknown as ContentIndex;

describe("routeMeta", () => {
  it("describes the landing for search and marks it indexable", () => {
    const m = routeMeta("/", index);
    expect(m.title).toBe("DECA Masters: practise DECA cluster exams, role plays and vocab");
    expect(m.canonical).toBe(`${SITE_URL}/`);
    expect(m.robots).toBe("index,follow");
    expect(m.jsonLd[0]).toMatchObject({ "@type": "WebSite", url: `${SITE_URL}/`, name: "DECA Masters" });
  });

  it("names an event page after the event and uses its own summary", () => {
    const m = routeMeta("/events/PMK", index);
    expect(m.title).toBe("Principles of Marketing (PMK) | DECA Masters");
    expect(m.description).toBe("You play a marketing employee & answer a manager's <questions>.");
    expect(m.canonical).toBe(`${SITE_URL}/events/PMK`);
    expect(m.jsonLd.map((j) => j["@type"])).toEqual(["WebPage", "BreadcrumbList"]);
  });

  it("keeps an unknown event and every members-only page out of the index", () => {
    expect(routeMeta("/events/ZZZ", index).robots).toBe("noindex,follow");
    expect(routeMeta("/owner", index)).toMatchObject({
      title: "Owner console | DECA Masters",
      robots: "noindex,nofollow",
    });
    expect(routeMeta("/practice/run", index).robots).toBe("noindex,nofollow");
    expect(routeMeta("/login", index).robots).toBe("noindex,follow");
  });

  it("drops a trailing slash so one page has one address", () => {
    expect(routeMeta("/terms/", index).canonical).toBe(`${SITE_URL}/terms`);
  });
});

describe("headTags", () => {
  it("escapes text in attributes and keeps JSON-LD from closing its script", () => {
    const html = headTags(routeMeta("/events/PMK", index));
    expect(html).toContain(
      '<meta name="description" content="You play a marketing employee &amp; answer a manager&#39;s &lt;questions&gt;.">',
    );
    expect(html).toContain('<meta property="og:image" content="' + SITE_URL + '/og/deca-masters.png">');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image">');
    expect(html).not.toMatch(/<questions>/);
    expect(html).toContain(String.fromCharCode(92) + "u003cquestions>");
  });
});

describe("publicPaths, sitemapXml and robotsTxt", () => {
  it("lists every public page, events from the content index included", () => {
    const paths = publicPaths(index);
    expect(paths).toEqual(
      expect.arrayContaining(["/", "/events", "/events/ACT", "/events/PMK", "/vocab", "/roleplay", "/terms", "/privacy", "/credits", "/signup"]),
    );
    expect(paths).not.toContain("/login");
    expect(paths).not.toContain("/owner");
  });

  it("writes absolute URLs in the sitemap and points robots.txt at it", () => {
    const xml = sitemapXml(["/", "/events/PMK"]);
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/events/PMK</loc>`);
    expect(robotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
    expect(robotsTxt()).toContain("Disallow: /owner");
  });
});
