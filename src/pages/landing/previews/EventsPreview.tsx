import { ArrowRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FilterChips } from "../../../components/ui/Navigation";
import {
  Table,
  TableFrame,
  TBody,
  Td,
  Th,
  THead,
  Tr,
} from "../../../components/ui/Table";
import { FacetMarker } from "../../../components/ui/Tag";
import { CLUSTERS, type EventItem } from "../../../lib/content";
import { FORMAT_LABEL, formatOf, type FormatId } from "../data";
import { AppWindow } from "./AppWindow";

const ROWS = 6;
const FORMATS = Object.keys(FORMAT_LABEL) as FormatId[];

/** The real event list, filtered by format. Every row is a real event page. */
export function EventsPreview({ events }: { events: EventItem[] }) {
  const [format, setFormat] = useState<FormatId>("roleplay");
  const rows = useMemo(
    () =>
      events
        .filter((e) => formatOf(e) === format)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [events, format],
  );

  return (
    <AppWindow path="/events" note="Real events">
      {events.length ? (
        <>
          <FilterChips
            label="Format"
            chips={FORMATS.map((f) => ({
              id: f,
              label: FORMAT_LABEL[f].title,
              count: events.filter((e) => formatOf(e) === f).length,
            }))}
            value={[format]}
            onChange={([f]) => f && setFormat(f as FormatId)}
          />
          <TableFrame className="mt-4">
            <Table>
              <caption className="sr-only">
                {FORMAT_LABEL[format].title} events, first {ROWS}
              </caption>
              <THead>
                <tr>
                  <Th className="w-20">Code</Th>
                  <Th>Event</Th>
                  <Th className="hidden sm:table-cell">Cluster</Th>
                </tr>
              </THead>
              <TBody>
                {rows.slice(0, ROWS).map((e) => (
                  <Tr key={e.code}>
                    <Td code>{e.code}</Td>
                    <Td>
                      <Link
                        to={`/events/${e.code}`}
                        className="text-ink hover:text-link"
                      >
                        {e.name}
                      </Link>
                    </Td>
                    <Td className="hidden text-ink-2 sm:table-cell">
                      <span className="inline-flex items-center gap-2">
                        <FacetMarker cluster={e.cluster} size="sm" />
                        {CLUSTERS[e.cluster]}
                      </span>
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </TableFrame>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-ink-2">
            <span>
              Showing {Math.min(ROWS, rows.length)} of {rows.length}
            </span>
            <Link
              to="/events"
              className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-link"
            >
              Browse all {events.length} events
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
        </>
      ) : (
        <p className="text-ink-2">
          The event list is not published here yet, so there is nothing to
          filter.
        </p>
      )}
    </AppWindow>
  );
}
