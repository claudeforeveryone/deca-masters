import { afterEach, describe, expect, it } from "vitest";
import { applyMeta } from "./applyMeta";
import { routeMeta } from "./seo";

afterEach(() => {
  document.head.innerHTML = "";
  document.title = "";
});

const content = (sel: string) =>
  document.head.querySelector(sel)?.getAttribute("content") ?? null;

describe("applyMeta", () => {
  it("sets the title, description, robots, canonical and social tags for a route", () => {
    applyMeta(document, routeMeta("/terms"));
    expect(document.title).toBe("Terms of Use | DECA Masters");
    expect(content('meta[name="description"]')).toMatch(/plain language/i);
    expect(content('meta[name="robots"]')).toBe("index,follow");
    expect(
      document.head
        .querySelector('link[rel="canonical"]')
        ?.getAttribute("href"),
    ).toMatch(/\/terms$/);
    expect(content('meta[property="og:title"]')).toBe(
      "Terms of Use | DECA Masters",
    );
  });

  it("replaces the tags of the page before instead of piling them up", () => {
    applyMeta(document, routeMeta("/terms"));
    applyMeta(document, routeMeta("/owner"));
    expect(
      document.head.querySelectorAll('meta[name="description"]'),
    ).toHaveLength(1);
    expect(
      document.head.querySelectorAll('link[rel="canonical"]'),
    ).toHaveLength(1);
    expect(content('meta[name="robots"]')).toBe("noindex,nofollow");
    // A members-only page carries no structured data.
    expect(
      document.head.querySelectorAll('script[type="application/ld+json"]'),
    ).toHaveLength(0);
  });

  it("writes structured data for a public page", () => {
    applyMeta(document, routeMeta("/privacy"));
    const ld = document.head.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(JSON.parse(ld!.textContent!)["@type"]).toBe("WebPage");
  });
});
