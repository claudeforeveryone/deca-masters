// Build step after `vite build` and the SSR build of src/entry-server.tsx: renders the signed-out landing (/) to HTML
// and writes it into dist/index.html, so the first paint is real text and posters instead of an empty page waiting on
// JavaScript. main.tsx hydrates it. Every other path, and any visitor with a stored session, gets the plain client
// render: they are served dist/app.html, the plain shell (vercel.json), and index.html's head script still hides the
// prerender before first paint if index.html itself reaches one of them.
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
const shell = readFileSync(page, "utf8");
// Deep links get the shell without the landing's markup and preloads (vercel.json rewrites them to app.html).
writeFileSync(resolve(dist, "app.html"), shell);
writeFileSync(
  page,
  injectPrerender(shell, markup, chunkFiles(manifest, "src/pages/home/HomePage.tsx")),
);
// The manifest is a build input only; it is not served.
rmSync(resolve(dist, ".vite"), { recursive: true, force: true });
// supabase-js keeps a refresh timer alive, so exit once the line is written.
process.stdout.write(
  `prerender: / written into dist/index.html (${Math.round(markup.length / 1024)} KB of markup), shell in dist/app.html
`,
  () => process.exit(0),
);
