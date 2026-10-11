// Build-time render of public pages to HTML (scripts/prerender.mjs runs it on the SSR build). The tree matches
// main.tsx's hydrate path: same providers, and the home page passed in directly so nothing suspends.
import { StrictMode } from "react";
import { prerender } from "react-dom/static";
import { StaticRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";

export async function renderPage(url: string): Promise<string> {
  // Loaded the way App.tsx loads it (dynamically), so the SSR build does not import one module both ways.
  const { HomePage } = await import("./pages/home/HomePage");
  const { prelude } = await prerender(
    <StrictMode>
      <StaticRouter
        location={url}
        basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}
      >
        <AuthProvider>
          <App home={HomePage} />
        </AuthProvider>
      </StaticRouter>
    </StrictMode>,
    // React outlines a boundary bigger than this many bytes: the HTML paints its fallback, then a script swaps the page
    // in. The page is the point of prerendering, so keep every boundary inline.
    { progressiveChunkSize: Number.POSITIVE_INFINITY },
  );
  return new Response(prelude).text();
}
