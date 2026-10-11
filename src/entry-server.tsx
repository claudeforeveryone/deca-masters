// Build-time render of public pages to HTML (scripts/prerender.mjs runs it on the SSR build). The tree matches
// main.tsx's hydrate path: same providers, and the page's chunk loaded first so nothing suspends.
import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import { App, preloadRoute } from "./App";
import { AuthProvider } from "./lib/auth";

// The prerender script primes content from disk, reads back what each page used, and writes each page's head.
export { contentReads, primeContent, resetContentCache } from "./lib/content";
export {
  headTags,
  publicPaths,
  robotsTxt,
  routeMeta,
  sitemapXml,
} from "./lib/seo";

export async function renderPage(url: string): Promise<string> {
  await preloadRoute(new URL(url, "https://prerender.invalid").pathname);
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter
        location={url}
        basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}
      >
        <AuthProvider>
          <App />
        </AuthProvider>
      </StaticRouter>
    </StrictMode>,
    // React outlines a boundary bigger than this many bytes: the HTML paints its fallback, then a script swaps the page
    // in. The page is the point of prerendering, so keep every boundary inline.
    { progressiveChunkSize: Number.POSITIVE_INFINITY },
  );
  return new Response(prelude).text();
}
