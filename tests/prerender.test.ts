// @vitest-environment node
import { describe, expect, it } from "vitest";
// Plain ESM shared with the build (scripts/prerender.mjs).
import { chunkFiles, injectPrerender } from "../scripts/prerender-lib.mjs";

const PAGE = [
  "<!doctype html><html><head><title>x</title>",
  '<script type="module" crossorigin src="/assets/index-a.js"></script>',
  '<link rel="modulepreload" crossorigin href="/assets/react-r.js">',
  '</head><body><div id="root"></div></body></html>',
].join("");

const MANIFEST = {
  "index.html": {
    file: "assets/index-a.js",
    isEntry: true,
    imports: ["_react-r.js"],
    dynamicImports: ["src/pages/home/HomePage.tsx"],
  },
  "_react-r.js": { file: "assets/react-r.js" },
  "src/pages/home/HomePage.tsx": {
    file: "assets/HomePage-h.js",
    isDynamicEntry: true,
    imports: ["_react-r.js", "_Posters-p.js"],
  },
  "_Posters-p.js": { file: "assets/Posters-p.js", imports: ["_react-r.js"] },
};

describe("chunkFiles", () => {
  it("lists a module's chunk and every chunk it imports, once each", () => {
    expect(chunkFiles(MANIFEST, "src/pages/home/HomePage.tsx")).toEqual([
      "assets/HomePage-h.js",
      "assets/react-r.js",
      "assets/Posters-p.js",
    ]);
  });

  it("fails loudly when the module is not in the build", () => {
    expect(() => chunkFiles(MANIFEST, "src/pages/Nope.tsx")).toThrow(
      /Nope\.tsx/,
    );
  });
});

describe("injectPrerender", () => {
  it("puts the markup inside the empty root and marks it as prerendered", () => {
    const out = injectPrerender(PAGE, "<main>Hi</main>", []);
    expect(out).toContain(
      '<div id="root" data-prerendered><main>Hi</main></div>',
    );
  });

  it("preloads the page's chunks from the head, skipping ones already linked", () => {
    const out = injectPrerender(PAGE, "<p>x</p>", [
      "assets/HomePage-h.js",
      "assets/react-r.js",
    ]);
    const head = out.slice(0, out.indexOf("</head>"));
    expect(head).toContain(
      '<link rel="modulepreload" crossorigin href="/assets/HomePage-h.js">',
    );
    expect(head.match(/react-r\.js/g)).toHaveLength(1);
  });

  it("refuses a page without an empty root rather than shipping it unrendered", () => {
    expect(() =>
      injectPrerender(PAGE.replace('id="root"', 'id="app"'), "<p>x</p>", []),
    ).toThrow(/#root/);
  });
});
