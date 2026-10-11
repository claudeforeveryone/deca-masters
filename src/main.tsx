import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Self-hosted faces (no third-party font requests). Only the weights the tokens use.
import "@fontsource/saira-semi-condensed/600.css";
import "@fontsource/saira-semi-condensed/700.css";
import "@fontsource-variable/instrument-sans/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./index.css";
import { App, preloadRoute } from "./App";
import { AuthProvider } from "./lib/auth";
import { primeContent } from "./lib/content";
import { registerServiceWorker, startOutboundTracking } from "./lib/pwa";

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

startOutboundTracking();
registerServiceWorker();

const tree = () => (
  <StrictMode>
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}
    >
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

// A production build ships public pages as HTML for a signed-out visitor (scripts/prerender.mjs), with the content
// each one showed embedded as JSON. index.html's head script marks the visits the HTML does not fit (another path, or
// a stored session) before first paint, and those render from scratch.
const html = document.documentElement;

// Embedded content saves a fetch either way, and hydration needs the exact data the HTML was rendered from.
try {
  const embedded = document.getElementById("prerender-content")?.textContent;
  if (embedded)
    for (const [file, data] of Object.entries(
      JSON.parse(embedded) as Record<string, unknown>,
    ))
      primeContent(file, data);
} catch {
  // Unreadable: pages fetch their content as usual.
}

function renderFromScratch(container: HTMLElement) {
  container.replaceChildren();
  container.removeAttribute("data-prerendered");
  html.removeAttribute("data-prerender-skip");
  createRoot(container).render(tree());
}

if (root.hasAttribute("data-prerendered") && !html.hasAttribute("data-prerender-skip")) {
  // Load the page's module before hydrating, so hydration never suspends on its chunk (a suspended boundary that then
  // sees the session resolve would throw the HTML away and flash the loading state). If the chunk cannot load, render
  // normally: the route's lazy load retries and its error boundary explains, instead of a dead page.
  preloadRoute(location.pathname).then(
    () => hydrateRoot(root, tree()),
    () => renderFromScratch(root),
  );
} else {
  renderFromScratch(root);
}
