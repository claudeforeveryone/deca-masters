import { describe, expect, it } from "vitest";
import { classifyOutbound } from "./outbound";

const ORIGIN = "https://deca-masters.vercel.app";

describe("classifyOutbound", () => {
  it("tags an official DECA PDF opened from an event page with that event's code", () => {
    expect(
      classifyOutbound(
        "https://www.deca.org/hubfs/2026/PMK-guidelines.pdf",
        "/events/PMK",
        ORIGIN,
      ),
    ).toEqual({ code: "PMK", meta: { source: "official", kind: "pdf" } });
  });

  it("tags an openly licensed source opened from a deck page with the deck slug", () => {
    expect(
      classifyOutbound("https://opentextbc.ca/introtourism2e/chapter/x/", "/vocab/hospitality-tourism", ORIGIN),
    ).toEqual({ code: "hospitality-tourism", meta: { source: "licensed", kind: "page" } });
  });

  it("ignores links inside the site, mail links and anything not https", () => {
    expect(classifyOutbound("/events", "/", ORIGIN)).toBeNull();
    expect(classifyOutbound(`${ORIGIN}/credits`, "/", ORIGIN)).toBeNull();
    expect(classifyOutbound("mailto:josephislockedin@gmail.com", "/privacy", ORIGIN)).toBeNull();
    expect(classifyOutbound("http://example.org/", "/credits", ORIGIN)).toBeNull();
  });

  it("sends no code from pages that are not about one event or deck", () => {
    expect(classifyOutbound("https://www.deca.org/", "/credits", ORIGIN)).toEqual({
      code: null,
      meta: { source: "official", kind: "page" },
    });
  });
});
