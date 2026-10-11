// @vitest-environment node
// The landing is rendered to HTML at build time (scripts/prerender.mjs). This runs that render with no window,
// document or storage, the way the build does, so a browser-only read during render fails here first.
import { describe, expect, it } from "vitest";
import { renderPage } from "./entry-server";

describe("renderPage", () => {
  it("renders the signed-out landing for / without browser APIs", async () => {
    const html = await renderPage("/");
    expect(html).toContain('id="hero-title"');
    expect(html).toContain("Walk in");
    expect(html).toMatch(/not affiliated with DECA Inc/i);
    // The computed posters are part of the first paint.
    expect(html).toContain("<polygon");
    // Signed-out header actions.
    expect(html).toContain("Create an account");
  });

  it("inlines the page instead of streaming it in behind a reveal script", async () => {
    const html = await renderPage("/");
    // An outlined boundary paints its fallback (and the footer) first, then swaps the page in: a large layout shift.
    expect(html).not.toContain('<div hidden id="S:');
    expect(html).not.toContain("<script");
  });
});

describe("renderPage for other public pages", () => {
  it("renders the legal text itself, not a loading state", async () => {
    const html = await renderPage("/privacy");
    expect(html).toContain("Privacy Policy");
    expect(html).toContain("One login for two sites");
    expect(html).not.toContain('<div hidden id="S:');
  });

  it("renders an event page from primed content and reports what it read", async () => {
    const { primeContent, resetContentCache, contentReads } = await import(
      "./entry-server"
    );
    // A one-event index in the published shape (the real one is built, not committed).
    const index = {
      season: null,
      source: null,
      disclaimer: null,
      officialSamples: true,
      exams: [],
      vocab: [],
      roleplays: [],
      events: [
        {
          code: "PMK",
          name: "Principles of Marketing",
          category: "Principles of Business Administration Events",
          cluster: "marketing",
          exam: null,
          components: ["exam", "roleplay"],
          teamSize: "1",
          summary: "Fixture summary for the render test.",
          officialUrl: "https://www.deca.org/",
          verifiedAt: "2026-10-01",
          notes: null,
        },
      ],
    };
    resetContentCache();
    primeContent("index.json", index);
    const first = index.events[0];
    const html = await renderPage(`/events/${first.code}`);
    expect(html).toContain(first.name.replace(/&/g, "&amp;"));
    expect(contentReads()).toContain("index.json");
    resetContentCache();
  });

  it("renders the sign-up form for a signed-out visitor", async () => {
    const html = await renderPage("/signup");
    expect(html).toMatch(/type="password"/);
    expect(html).toContain("Create an account");
    expect(html).not.toContain("Checking your session");
  });
});
