// Pure helpers for scripts/prerender.mjs (tested in tests/prerender.test.ts).

/**
 * A module's built chunk followed by every chunk it imports statically, depth first, each once.
 * `manifest` is Vite's build manifest (dist/.vite/manifest.json); `key` is the module's source path.
 */
export function chunkFiles(manifest, key) {
  if (!manifest[key]) throw new Error(`prerender: ${key} is not in the build manifest`);
  const seen = new Set();
  const files = [];
  const walk = (k) => {
    if (seen.has(k)) return;
    seen.add(k);
    const chunk = manifest[k];
    if (!chunk) return;
    files.push(chunk.file);
    for (const dep of chunk.imports ?? []) walk(dep);
  };
  walk(key);
  return files;
}

/**
 * The built index.html with `markup` rendered inside #root (marked data-prerendered, which main.tsx hydrates) and a
 * modulepreload link in the head for each of `preloads` the page does not already load.
 */
export function injectPrerender(html, markup, preloads) {
  const empty = '<div id="root"></div>';
  if (!html.includes(empty)) throw new Error("prerender: index.html has no empty #root to fill");
  const links = preloads
    .filter((file) => !html.includes(`/${file}"`))
    .map((file) => `<link rel="modulepreload" crossorigin href="/${file}">`)
    .join("");
  // Replacer functions: a replacement string would expand $& and friends inside the page's own text.
  return html
    .replace("</head>", () => `${links}</head>`)
    .replace(empty, () => `<div id="root" data-prerendered>${markup}</div>`);
}

/** Which page module renders each prerendered path (its chunks are preloaded from the head). */
const PAGE_MODULES = [
  [/^\/$/, "src/pages/home/HomePage.tsx"],
  [/^\/signup$/, "src/pages/auth/SignupPage.tsx"],
  [/^\/events$/, "src/pages/events/EventsPage.tsx"],
  [/^\/events\/[^/]+$/, "src/pages/events/EventPage.tsx"],
  [/^\/roleplay$/, "src/pages/roleplay/RoleplayPage.tsx"],
  [/^\/vocab$/, "src/pages/vocab/VocabPage.tsx"],
  [/^\/terms$/, "src/pages/legal/TermsPage.tsx"],
  [/^\/privacy$/, "src/pages/legal/PrivacyPage.tsx"],
  [/^\/credits$/, "src/pages/legal/CreditsPage.tsx"],
];

export function pageModuleFor(path) {
  const hit = PAGE_MODULES.find(([re]) => re.test(path));
  if (!hit) throw new Error(`prerender: no page module is listed for ${path}`);
  return hit[1];
}

/** Where a path's HTML goes in dist so clean URLs serve it: /events -> events.html, / -> index.html. */
export function outFile(path) {
  return path === "/" ? "index.html" : `${path.slice(1)}.html`;
}

/** JSON inside a script element: "<" is escaped so nothing in it can close the element. */
const scriptJson = (v) => JSON.stringify(v).replace(/</g, "\\u003c");

/**
 * One prerendered page from the built shell: its own head tags in place of the shell's default title and description,
 * the path it was rendered for on <html> (index.html's head script hides the HTML anywhere else), the markup in #root,
 * its chunk preloads, and the content files it read, embedded so hydration starts from the same data.
 */
export function buildPage(shell, { path, markup, head, data, preloads }) {
  if (!shell.includes('<html lang="en-CA">')) throw new Error("prerender: the shell's <html> tag changed");
  const withHead = shell
    .replace(/<title>[\s\S]*?<\/title>/, "")
    .replace(/<meta\s+name="description"[\s\S]*?>/, "")
    .replace('<html lang="en-CA">', () => `<html lang="en-CA" data-prerender-path="${path}">`)
    .replace("</head>", () => `${head}</head>`);
  const filled = injectPrerender(withHead, markup, preloads);
  const embed = `<script type="application/json" id="prerender-content">${scriptJson(data)}</script>`;
  return filled.replace("</body>", () => `${embed}</body>`);
}

/** The plain shell served for every path that is not prerendered (members pages, unknown links): never indexed. */
export function shellPage(shell) {
  return shell.replace("</head>", () => '<meta name="robots" content="noindex"></head>');
}
