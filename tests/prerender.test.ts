// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
// Plain ESM shared with the build (scripts/prerender.mjs).
import {
  buildPage,
  chunkFiles,
  injectPrerender,
  outFile,
  pageModuleFor,
  shellPage,
} from "../scripts/prerender-lib.mjs";
import { PREF_PREFIX } from "../src/lib/prefs";
import { SESSION_STORAGE_KEY } from "../src/lib/supabase";

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

  it("copies the markup literally, dollar signs included", () => {
    const markup = "<p>Costs $& and $' and $` and $$</p>";
    expect(injectPrerender(PAGE, markup, [])).toContain(
      `<div id="root" data-prerendered>${markup}</div>`,
    );
  });

  it("refuses a page without an empty root rather than shipping it unrendered", () => {
    expect(() =>
      injectPrerender(PAGE.replace('id="root"', 'id="app"'), "<p>x</p>", []),
    ).toThrow(/#root/);
  });
});

const SHELL = [
  '<!doctype html><html lang="en-CA"><head>',
  "<title>Default</title>",
  // As Vite writes it: the source's line breaks inside the tag are kept.
  `<meta
      name="description"
      content="Default words"
    />`,
  '</head><body><div id="root"></div></body></html>',
].join("");

describe("buildPage", () => {
  const page = buildPage(SHELL, {
    path: "/events/PMK",
    markup: "<h1>PMK</h1>",
    head: '<title>PMK | DECA Masters</title><meta name="description" content="About PMK">',
    data: { "index.json": { note: "</script><b>" } },
    preloads: ["assets/EventPage-e.js"],
  });

  it("swaps the shell's default title and description for the page's own", () => {
    expect(page).not.toContain("Default words");
    expect(page).not.toContain("<title>Default</title>");
    expect(page.match(/<title>/g)).toHaveLength(1);
    expect(page).toContain("<title>PMK | DECA Masters</title>");
  });

  it("marks which path the HTML is for, so another path never shows it", () => {
    expect(page).toContain(
      '<html lang="en-CA" data-prerender-path="/events/PMK">',
    );
    expect(page).toContain(
      '<div id="root" data-prerendered><h1>PMK</h1></div>',
    );
  });

  it("embeds the content the page used without letting it close the script", () => {
    const json =
      /<script type="application\/json" id="prerender-content">([\s\S]*?)<\/script>/.exec(
        page,
      );
    expect(json).not.toBeNull();
    expect(JSON.parse(json![1])).toEqual({
      "index.json": { note: "</script><b>" },
    });
  });

  it("preloads the page's chunks", () => {
    expect(page).toContain('href="/assets/EventPage-e.js"');
  });
});

describe("shellPage", () => {
  it("keeps the plain shell out of search results", () => {
    expect(shellPage(SHELL)).toContain(
      '<meta name="robots" content="noindex">',
    );
  });
});

describe("outFile and pageModuleFor", () => {
  it("writes each path where clean URLs serve it", () => {
    expect(outFile("/")).toBe("index.html");
    expect(outFile("/events")).toBe("events.html");
    expect(outFile("/events/PMK")).toBe("events/PMK.html");
  });

  it("knows the page module behind every prerendered path, and refuses others", () => {
    expect(pageModuleFor("/")).toBe("src/pages/home/HomePage.tsx");
    expect(pageModuleFor("/events/PMK")).toBe("src/pages/events/EventPage.tsx");
    expect(pageModuleFor("/privacy")).toBe("src/pages/legal/PrivacyPage.tsx");
    expect(() => pageModuleFor("/owner")).toThrow(/owner/);
  });
});

describe("index.html head script", () => {
  const head = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  it("reads the same session key as the app, so a stored session skips the prerender", () => {
    expect(head).toContain(`localStorage.getItem("${SESSION_STORAGE_KEY}")`);
  });

  it("reads the same theme key as the app", () => {
    expect(head).toContain(`localStorage.getItem("${PREF_PREFIX}theme")`);
  });

  // Runs the inline script against a stand-in document: true when it marks the visit to render from scratch.
  const script = /<script>([\s\S]*?)<\/script>/.exec(head)?.[1] ?? "";
  function skips(at: { path: string; search?: string; built: string; session?: boolean }) {
    const attrs = new Map<string, string>([["data-prerender-path", at.built]]);
    const documentElement = {
      dataset: {},
      getAttribute: (k: string) => attrs.get(k) ?? null,
      setAttribute: (k: string, v: string) => void attrs.set(k, v),
    };
    const storage = {
      getItem: (k: string) => (k === SESSION_STORAGE_KEY && at.session ? "{}" : null),
    };
    new Function("document", "location", "localStorage", script)(
      { documentElement },
      { pathname: at.path, search: at.search ?? "" },
      storage,
    );
    return attrs.has("data-prerender-skip");
  }

  it("hydrates the HTML built for this exact path, trailing slash or not", () => {
    expect(skips({ path: "/events", built: "/events" })).toBe(false);
    expect(skips({ path: "/events/", built: "/events" })).toBe(false);
  });

  it("renders from scratch on another path or with a stored session", () => {
    expect(skips({ path: "/practice", built: "/" })).toBe(true);
    expect(skips({ path: "/events", built: "/events", session: true })).toBe(true);
  });

  it("renders from scratch when a query string can change what the page shows", () => {
    // /events and /roleplay keep their filters in the URL; the HTML was built with none.
    expect(skips({ path: "/events", search: "?cluster=finance", built: "/events" })).toBe(true);
    expect(skips({ path: "/roleplay", search: "?cluster=marketing", built: "/roleplay" })).toBe(true);
  });
});

describe("vercel.json", () => {
  const config = JSON.parse(
    readFileSync(new URL("../vercel.json", import.meta.url), "utf8"),
  ) as {
    cleanUrls?: boolean;
    rewrites: { source: string; destination: string }[];
  };
  const shell = config.rewrites.find((r) => r.destination === "/app");
  const matches = (path: string) => new RegExp(`^${shell!.source}$`).test(path);

  it("serves prerendered pages at clean URLs (events.html at /events)", () => {
    expect(config.cleanUrls).toBe(true);
  });

  it("sends deep links to the plain shell", () => {
    expect(matches("/practice")).toBe(true);
    expect(matches("/events/PBM")).toBe(true);
  });

  it("leaves / to index.html, the prerendered landing, and files to themselves", () => {
    expect(matches("/")).toBe(false);
    expect(matches("/assets/index-a.js")).toBe(false);
    expect(matches("/content/index.json")).toBe(false);
  });
});
