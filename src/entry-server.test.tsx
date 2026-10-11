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
