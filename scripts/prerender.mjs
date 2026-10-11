// Build step after `vite build` and the SSR build of src/entry-server.tsx: renders every public page (the landing,
// events and each event, role-play and vocab hubs, legal pages, sign-up) to HTML for a signed-out visitor, with its own
// title, description, canonical URL, social card and JSON-LD, and the content it showed embedded for hydration.
// Writes sitemap.xml and robots.txt from the same list. With vercel.json's cleanUrls, dist/events.html is served at
// /events; every other path gets dist/app.html, the plain shell (noindex). main.tsx hydrates a prerendered page, and
// index.html's head script hides the HTML first when it does not fit (another path, or a stored session).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildPage,
  chunkFiles,
  outFile,
  pageModuleFor,
  shellPage,
} from "./prerender-lib.mjs";

const dist = resolve("dist");
const manifest = JSON.parse(
  readFileSync(resolve(dist, ".vite/manifest.json"), "utf8"),
);
const ssr = await import(
  pathToFileURL(resolve("dist-ssr/entry-server.js")).href
);

// The public content files a page may show; each page embeds only the ones it read.
const content = Object.fromEntries(
  ["index.json", "credits.json"].map((f) => [
    f,
    JSON.parse(readFileSync(resolve(dist, "content", f), "utf8")),
  ]),
);
const index = content["index.json"];

const shell = readFileSync(resolve(dist, "index.html"), "utf8");
writeFileSync(resolve(dist, "app.html"), shellPage(shell));

const paths = ssr.publicPaths(index);
let bytes = 0;
for (const path of paths) {
  ssr.resetContentCache();
  for (const [file, data] of Object.entries(content))
    ssr.primeContent(file, data);
  const markup = await ssr.renderPage(path);
  const used = Object.fromEntries(
    ssr
      .contentReads()
      .filter((f) => f in content)
      .map((f) => [f, content[f]]),
  );
  const html = buildPage(shell, {
    path,
    markup,
    head: ssr.headTags(ssr.routeMeta(path, index)),
    data: used,
    preloads: chunkFiles(manifest, pageModuleFor(path)),
  });
  const file = resolve(dist, outFile(path));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
  bytes += html.length;
}

writeFileSync(resolve(dist, "sitemap.xml"), ssr.sitemapXml(paths));
writeFileSync(resolve(dist, "robots.txt"), ssr.robotsTxt());
// The manifest is a build input only; it is not served.
rmSync(resolve(dist, ".vite"), { recursive: true, force: true });
// supabase-js keeps a refresh timer alive, so exit once the line is written.
process.stdout.write(
  `prerender: ${paths.length} pages (${Math.round(bytes / 1024)} KB), sitemap.xml, robots.txt; shell in dist/app.html\n`,
  () => process.exit(0),
);
