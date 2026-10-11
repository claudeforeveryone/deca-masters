// Build step after `vite build` and the SSR build of src/entry-server.tsx: renders the signed-out landing (/) to HTML
// and writes it into dist/index.html, so the first paint is real text and posters instead of an empty page waiting on
// JavaScript. main.tsx hydrates it. Every other path, and any visitor with a stored session, gets the plain client
// render: index.html's head script marks those before first paint (see the data-prerender-skip rule there).
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chunkFiles, injectPrerender } from "./prerender-lib.mjs";

const dist = resolve("dist");
const manifestPath = resolve(dist, ".vite/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const { renderPage } = await import(pathToFileURL(resolve("dist-ssr/entry-server.js")).href);

const markup = await renderPage("/");
const page = resolve(dist, "index.html");
const html = injectPrerender(
  readFileSync(page, "utf8"),
  markup,
  chunkFiles(manifest, "src/pages/home/HomePage.tsx"),
);
writeFileSync(page, html);
// The manifest is a build input only; it is not served.
rmSync(resolve(dist, ".vite"), { recursive: true, force: true });
console.log(`prerender: / written into dist/index.html (${Math.round(markup.length / 1024)} KB of markup)`);
// supabase-js keeps a refresh timer; nothing else is pending.
process.exit(0);
