import { describe, expect, it } from "vitest";

// Kbd, Tag, Button and IconButton set their own display (inline-flex), which beats a bare `hidden` passed in
// className, so `hidden sm:inline-flex` never hides them. Hide with a max-* variant (max-sm:hidden) or a wrapper.
const sources = import.meta.glob("/src/**/*.tsx", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const BARE_HIDDEN =
  /<(?:Kbd|Tag|Button|IconButton)\b[^>]*?className="(?:[^"]*\s)?hidden(?:\s[^"]*)?"/g;

describe("display utilities on components that set their own display", () => {
  it("finds the source files", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(50);
  });

  it("never passes a bare `hidden` to Kbd, Tag, Button or IconButton", () => {
    const hits = Object.entries(sources).flatMap(([file, text]) =>
      [...text.matchAll(BARE_HIDDEN)].map((m) => `${file}: ${m[0]}`),
    );
    expect(hits).toEqual([]);
  });
});
