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
  return html
    .replace("</head>", `${links}</head>`)
    .replace(empty, `<div id="root" data-prerendered>${markup}</div>`);
}
