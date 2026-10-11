import { StrictMode, type ComponentType } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
// Self-hosted faces (no third-party font requests). Only the weights the tokens use.
import "@fontsource/saira-semi-condensed/600.css";
import "@fontsource/saira-semi-condensed/700.css";
import "@fontsource-variable/instrument-sans/wght.css";
import "@fontsource-variable/jetbrains-mono/wght.css";
import "./index.css";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { registerServiceWorker, startOutboundTracking } from "./lib/pwa";

const root = document.getElementById("root");
if (!root) throw new Error("index.html is missing #root");

startOutboundTracking();
registerServiceWorker();

const tree = (home?: ComponentType) => (
  <StrictMode>
    <BrowserRouter
      basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}
    >
      <AuthProvider>
        <App home={home} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

// A production build ships the signed-out landing as HTML (scripts/prerender.mjs). index.html's head script marks the
// visits it does not fit (another path, or a stored session) before first paint, and those render from scratch.
const html = document.documentElement;

function renderFromScratch(container: HTMLElement) {
  container.replaceChildren();
  container.removeAttribute("data-prerendered");
  html.removeAttribute("data-prerender-skip");
  createRoot(container).render(tree());
}

if (root.hasAttribute("data-prerendered") && !html.hasAttribute("data-prerender-skip")) {
  // Load the home page module before hydrating, so hydration never suspends on its chunk (a suspended boundary that
  // then sees the session resolve would throw the HTML away and flash the loading state). If the chunk cannot load,
  // render normally: the route's lazy load retries and its error boundary explains, instead of a dead page.
  import("./pages/home/HomePage").then(
    ({ HomePage }) => hydrateRoot(root, tree(HomePage)),
    () => renderFromScratch(root),
  );
} else {
  renderFromScratch(root);
}
