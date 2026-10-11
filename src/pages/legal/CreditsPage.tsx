import { ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import { loadContentIndex, loadCredits, type Credits } from "../../lib/content";

type State =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      sources: Credits["sources"];
      eventSource: string | null;
    };

// Licences read from each package's package.json (2026-10-11). Update when a dependency is added.
const SOFTWARE = [
  {
    name: "Saira Semi Condensed, Instrument Sans, JetBrains Mono",
    what: "typefaces",
    licence: "SIL Open Font License 1.1",
  },
  { name: "Lucide", what: "icons", licence: "ISC" },
  {
    name: "React, React Router, Vite, Tailwind CSS",
    what: "the app itself",
    licence: "MIT",
  },
  { name: "Supabase JS", what: "accounts and data", licence: "MIT" },
  {
    name: "three.js, React Three Fiber, drei, Motion",
    what: "3D and motion",
    licence: "MIT",
  },
] as const;

/**
 * Who made what this site reuses. Content sources come from public/content/credits.json, which the build writes
 * from the same source fields shown on each question and term, so this list cannot drift from the content.
 */
export function CreditsPage() {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let active = true;
    Promise.all([loadCredits(), loadContentIndex()])
      .then(([credits, index]) => {
        if (active)
          setState({
            status: "ready",
            sources: credits.sources,
            eventSource: index.source,
          });
      })
      .catch(() => {
        if (active) setState({ status: "error" });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Credits"
        lede="DECA Masters reuses openly licensed material and credits it here and on every question and term. Nothing on this site is official DECA content."
      />

      <section aria-labelledby="content-heading" className="mt-10 max-w-3xl">
        <h2 id="content-heading" className="text-2xl">
          Practice content
        </h2>
        <div className="mt-4">
          {state.status === "loading" ? (
            <RouteFallback label="Loading credits" />
          ) : null}
          {state.status === "error" ? (
            <Notice tone="error">
              The credits list did not load. Refresh the page to try again.
            </Notice>
          ) : null}
          {state.status === "ready" && state.sources.length === 0 ? (
            <p className="max-w-(--measure) text-ink-2">
              No outside questions or vocab are published yet. When they are,
              each source appears here with its licence and a link, and the same
              credit shows on every item that uses it.
            </p>
          ) : null}
          {state.status === "ready" && state.sources.length > 0 ? (
            <ul className="border-t border-line">
              {state.sources.map((s) => (
                <li
                  key={s.url}
                  className="grid gap-1 border-b border-line py-4"
                >
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 font-semibold"
                  >
                    {s.title}
                    <ExternalLink aria-hidden="true" className="size-4" />
                    <span className="sr-only">(opens in a new tab)</span>
                  </a>
                  <p className="text-ink-2">{s.attribution}</p>
                  <p className="text-sm text-ink-3">
                    <span className="font-mono">{s.licence}</span>
                    {" · used in "}
                    {s.usedIn.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="events-heading" className="mt-12 max-w-3xl">
        <h2 id="events-heading" className="text-2xl">
          Event facts
        </h2>
        <p className="mt-3 max-w-(--measure) text-ink-2">
          Event names, formats and timings come from DECA&apos;s public pages on
          deca.org. Each event page links to its official source and shows the
          date it was checked. Role plays link to DECA&apos;s official samples
          instead of copying them.
          {state.status === "ready" && state.eventSource
            ? ` Current list: ${state.eventSource}.`
            : null}
        </p>
      </section>

      <section aria-labelledby="software-heading" className="mt-12 max-w-3xl">
        <h2 id="software-heading" className="text-2xl">
          Software and type
        </h2>
        <dl className="mt-4 border-t border-line">
          {SOFTWARE.map((s) => (
            <div
              key={s.name}
              className="grid gap-1 border-b border-line py-3 sm:grid-cols-[minmax(0,1fr)_14rem] sm:gap-6"
            >
              <dt>
                <span className="font-semibold">{s.name}</span>
                <span className="text-ink-3"> · {s.what}</span>
              </dt>
              <dd className="text-ink-2">{s.licence}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-12 max-w-(--measure) text-sm text-ink-3">
        DECA Masters is an independent study tool made by students. It is not
        affiliated with, endorsed by, or sponsored by DECA Inc.
      </p>
    </div>
  );
}
