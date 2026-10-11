import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { EmptyState } from "../../components/ui/EmptyState";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import {
  CLUSTERS,
  loadContentIndex,
  peekContentIndex,
  type EventItem,
} from "../../lib/content";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; events: EventItem[] };

export function EventsPage() {
  // Starts from data already here (prerendered page, or a revisit), so there is no loading flash to hydrate past.
  const [state, setState] = useState<State>(() => {
    const index = peekContentIndex();
    return index
      ? { status: "ready", events: index.events }
      : { status: "loading" };
  });

  useEffect(() => {
    let active = true;
    loadContentIndex()
      .then((index) => {
        if (active) setState({ status: "ready", events: index.events });
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
        title="Events"
        lede="The DECA events this site covers, with their exams and what each one involves. Details come from deca.org and are checked before they go live."
      />
      <div className="mt-8">
        {state.status === "loading" ? (
          <RouteFallback label="Loading events" />
        ) : null}
        {state.status === "error" ? (
          <Notice tone="error">
            The event list did not load. Refresh the page to try again.
          </Notice>
        ) : null}
        {state.status === "ready" && state.events.length === 0 ? (
          <EmptyState
            title="No events published yet"
            body="Event details are added from deca.org and checked before they go live. Nothing is guessed or filled in."
          />
        ) : null}
        {state.status === "ready" && state.events.length > 0 ? (
          <ul className="border-t border-line">
            {state.events.map((event) => (
              <li key={event.code} className="border-b border-line">
                <Link
                  to={`/events/${encodeURIComponent(event.code)}`}
                  className="group grid gap-1 py-5 text-ink no-underline sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-6"
                >
                  <span className="font-mono text-sm font-semibold text-ink-2">
                    {event.code}
                  </span>
                  <span>
                    <span className="block font-display text-2xl font-bold transition-colors duration-(--dur-1) group-hover:text-link">
                      {event.name}
                    </span>
                    <span className="mt-1 block text-sm text-ink-3">
                      {CLUSTERS[event.cluster] ?? event.cluster}
                    </span>
                    <span className="mt-2 block max-w-(--measure) text-ink-2">
                      {event.summary}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
