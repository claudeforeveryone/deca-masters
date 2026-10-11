import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../components/ui/EmptyState";
import { Tabs } from "../../components/ui/Tabs";
import { FacetMarker, Tag } from "../../components/ui/Tag";
import { componentsLine, pct, plural, whenLabel } from "../../lib/format";
import { LEVEL_NAMES } from "../../lib/readiness";
import {
  areaState,
  linkedTo,
  type AreaNode,
  type AreaState,
  type MapNode,
  type StrategyMap as Graph,
} from "../../lib/strategyMap";

const STATE_TEXT: Record<AreaState, string> = {
  untouched: "Not started",
  thin: "Under 5 answers",
  weak: "Weak: under 70%",
  steady: "Steady: 70 to 84%",
  strong: "Strong: 85% and up",
};

function StateFacet({ state }: { state: AreaState }) {
  const look: Record<AreaState, string> = {
    untouched: "border border-line-strong bg-transparent!",
    thin: "border border-ink-3 bg-surface-2!",
    weak: "bg-bad!",
    steady: "bg-accent!",
    strong: "bg-good!",
  };
  return <span aria-hidden="true" className={`facet size-2! ${look[state]}`} />;
}

const areaLink = (a: AreaNode) =>
  `/practice?${new URLSearchParams({ mode: "area", exam: a.exam, area: a.area })}`;

function stats(n: MapNode): string {
  switch (n.kind) {
    case "event":
      return componentsLine(n.components);
    case "exam":
      return n.answered
        ? `${n.seen} of ${n.questions} seen · ${pct(n.correct / n.answered)}`
        : `${plural(n.questions, "question")} in the bank`;
    case "deck":
      return `${n.mastered} of ${n.terms} mastered${n.due ? ` · ${n.due} due` : ""}`;
    case "roleplay":
      return n.sessions
        ? plural(n.sessions, "timed session")
        : "No sessions yet";
    case "area":
      return n.answered
        ? `${plural(n.answered, "answer")} · ${pct(n.correct / n.answered)} · ${n.seen}/${n.questions} seen`
        : `${n.questions} in the bank · not started`;
  }
}

function kindLabel(n: MapNode): string {
  return n.kind === "exam"
    ? "Exam"
    : n.kind === "deck"
      ? "Vocab"
      : n.kind === "roleplay"
        ? "Role play"
        : n.kind === "event"
          ? "Event"
          : "Area";
}

function nodeTitle(n: MapNode): string {
  switch (n.kind) {
    case "event":
      return n.code;
    case "exam":
    case "deck":
      return n.title;
    case "roleplay":
      return `${n.code} trainer`;
    case "area":
      return n.area;
  }
}

type Path = { from: string; to: string; d: string };

/** Transit-map connectors: horizontal runs joined by a vertical with 45 degree chamfered corners. */
function connector(x1: number, y1: number, x2: number, y2: number): string {
  const xm = Math.round((x1 + x2) / 2);
  const dy = y2 - y1;
  if (Math.abs(dy) < 1) return `M${x1},${y1}H${x2}`;
  const c = Math.min(10, Math.abs(dy) / 2, (x2 - x1) / 4);
  const s = Math.sign(dy);
  return `M${x1},${y1}H${xm - c}L${xm},${y1 + s * c}V${y2 - s * c}L${xm + c},${y2}H${x2}`;
}

function MapNodeButton({
  node,
  selected,
  lit,
  dim,
  onSelect,
  onHover,
}: {
  node: MapNode;
  selected: boolean;
  lit: boolean;
  dim: boolean;
  onSelect: () => void;
  onHover: (on: boolean) => void;
}) {
  const state = node.kind === "area" ? areaState(node) : null;
  return (
    <button
      type="button"
      data-node={node.id}
      aria-pressed={selected}
      onClick={onSelect}
      onPointerEnter={(e) => e.pointerType === "mouse" && onHover(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && onHover(false)}
      className={`relative grid w-full min-w-0 gap-0.5 rounded-sm border px-3 py-2 text-left transition-[opacity,border-color,background-color] duration-(--dur-2) ease-out ${
        selected
          ? "border-electric bg-surface-2"
          : lit
            ? "border-line-strong bg-surface"
            : "border-line bg-surface hover:border-line-strong"
      } ${dim ? "text-ink-3 [&_.facet]:opacity-35 [&_[data-bar]]:opacity-35" : ""}`}
    >
      <span className="flex min-w-0 items-center gap-2">
        {node.kind === "event" ? (
          <FacetMarker cluster={node.cluster} />
        ) : state ? (
          <StateFacet state={state} />
        ) : (
          <FacetMarker
            tone={lit || selected ? "electric" : "muted"}
            size="sm"
          />
        )}
        <span
          className={`min-w-0 truncate font-semibold ${node.kind === "event" ? "font-mono" : ""}`}
        >
          {node.kind === "event" || node.kind === "area" ? null : (
            <span className="font-normal text-ink-3">{kindLabel(node)} </span>
          )}
          {nodeTitle(node)}
        </span>
        {node.kind === "event" && node.main ? (
          <span className="ml-auto shrink-0 text-micro font-semibold text-link">
            Main
          </span>
        ) : null}
        {node.kind === "exam" && node.outside ? (
          <span className="ml-auto shrink-0 text-micro text-ink-3">
            Not in your events
          </span>
        ) : null}
      </span>
      <span className={`truncate text-sm ${dim ? "" : "text-ink-2"}`}>
        {node.kind === "event" ? node.name : stats(node)}
      </span>
      {node.kind === "area" && node.answered > 0 ? (
        <span
          aria-hidden="true"
          data-bar
          className="relative mt-1 h-1 overflow-hidden rounded-xs bg-line"
        >
          <span
            className={`absolute inset-y-0 left-0 w-full origin-left ${state === "weak" ? "bg-bad" : state === "strong" ? "bg-good" : "bg-electric"}`}
            style={{ transform: `scaleX(${node.correct / node.answered})` }}
          />
        </span>
      ) : null}
    </button>
  );
}

function Column({
  title,
  ids,
  map,
  children,
}: {
  title: string;
  ids: string[];
  map: Graph;
  children: (n: MapNode) => ReactNode;
}) {
  return (
    <div className="grid min-w-0 content-start gap-2">
      <h3 className="text-sm font-semibold text-ink-3">{title}</h3>
      {ids.length ? (
        <ul className="grid gap-2">
          {ids.map((id) => {
            const n = map.nodes.get(id);
            return n ? <li key={id}>{children(n)}</li> : null;
          })}
        </ul>
      ) : (
        <p className="text-sm text-ink-3">None yet.</p>
      )}
    </div>
  );
}

/** The drawn map: three columns, connectors measured from the real node boxes, selection lights its path. */
function DrawnMap({
  map,
  selected,
  onSelect,
}: {
  map: Graph;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [paths, setPaths] = useState<Path[]>([]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const focus = hover ?? selected;
  const lit = useMemo(
    () => (focus ? linkedTo(map, focus) : null),
    [map, focus],
  );

  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    function measure() {
      if (!el) return;
      const wide = window.matchMedia("(min-width: 768px)").matches;
      const origin = el.getBoundingClientRect();
      setSize({ w: origin.width, h: origin.height });
      if (!wide) return setPaths([]);
      const rect = (id: string) =>
        el
          .querySelector(`[data-node="${CSS.escape(id)}"]`)
          ?.getBoundingClientRect() ?? null;
      const next: Path[] = [];
      for (const [from, to] of map.edges) {
        const a = rect(from);
        const b = rect(to);
        if (!a || !b) continue;
        next.push({
          from,
          to,
          d: connector(
            Math.round(a.right - origin.left),
            Math.round(a.top + a.height / 2 - origin.top),
            Math.round(b.left - origin.left),
            Math.round(b.top + b.height / 2 - origin.top),
          ),
        });
      }
      setPaths(next);
    }
    measure();
    const ro =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(measure);
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [map]);

  const node = (n: MapNode) => (
    <MapNodeButton
      node={n}
      selected={selected === n.id}
      lit={Boolean(lit?.has(n.id))}
      dim={Boolean(lit && !lit.has(n.id))}
      onSelect={() => onSelect(n.id)}
      onHover={(on) => setHover(on ? n.id : null)}
    />
  );

  return (
    <div ref={box} className="relative">
      <svg
        aria-hidden="true"
        width={size.w}
        height={size.h}
        className="pointer-events-none absolute inset-0 hidden overflow-visible md:block"
      >
        {paths.map((p) => {
          const on = lit ? lit.has(p.from) && lit.has(p.to) : false;
          return (
            <path
              key={`${p.from}>${p.to}`}
              d={p.d}
              fill="none"
              stroke={on ? "var(--electric)" : "var(--line-strong)"}
              strokeWidth={on ? 2 : 1}
              strokeLinejoin="round"
              opacity={lit && !on ? 0.3 : 1}
              className="transition-[opacity,stroke] duration-(--dur-2)"
            />
          );
        })}
      </svg>
      <div className="relative grid gap-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1.2fr)] md:gap-x-12 lg:gap-x-16">
        <Column title="Your events" ids={map.columns.events} map={map}>
          {node}
        </Column>
        <Column
          title="What you practise them with"
          ids={map.columns.tracks}
          map={map}
        >
          {node}
        </Column>
        <Column title="Instructional areas" ids={map.columns.areas} map={map}>
          {node}
        </Column>
      </div>
    </div>
  );
}

function Detail({ map, id }: { map: Graph; id: string | null }) {
  const n = id ? map.nodes.get(id) : null;
  if (!n)
    return (
      <p className="text-ink-2">
        Select anything on the map to see its numbers and where to practise it.
      </p>
    );
  const linked = [...linkedTo(map, n.id)]
    .filter((x) => x !== n.id)
    .map((x) => map.nodes.get(x))
    .filter((x): x is MapNode => Boolean(x));
  const links: ReactNode[] = [];
  let facts: ReactNode = null;
  switch (n.kind) {
    case "event":
      facts = (
        <>
          {n.name}. {componentsLine(n.components)}.
        </>
      );
      links.push(
        <Link key="e" to={`/events/${encodeURIComponent(n.code)}`}>
          Event page
        </Link>,
      );
      break;
    case "exam": {
      facts = (
        <>
          {plural(n.questions, "question")} in this bank
          {n.status === "placeholder"
            ? " (a placeholder bank: sourced questions are still being added)"
            : ""}
          . You have seen {n.seen} of them and answered{" "}
          {plural(n.answered, "time")}
          {n.answered ? `, ${pct(n.correct / n.answered)} correct` : ""}.
        </>
      );
      links.push(
        <Link key="p" to={`/practice?exam=${encodeURIComponent(n.exam)}`}>
          Practise this exam
        </Link>,
      );
      break;
    }
    case "deck":
      facts = (
        <>
          {n.mastered} of {n.terms} terms mastered, {n.seen} seen, {n.due} due
          now.
        </>
      );
      links.push(
        <Link key="v" to={`/vocab/${encodeURIComponent(n.deck)}`}>
          Open the deck
        </Link>,
      );
      break;
    case "roleplay":
      facts = n.sessions ? (
        <>
          {plural(n.sessions, "timed session")}, the last{" "}
          {n.lastAt ? whenLabel(n.lastAt).toLowerCase() : "a while ago"}
          {n.avgLevel !== null
            ? `. Average self-rating: ${LEVEL_NAMES[Math.max(0, Math.min(3, Math.round(n.avgLevel)))]}`
            : ""}
          .
        </>
      ) : (
        <>No timed sessions for {n.code} yet.</>
      );
      links.push(
        <Link key="r" to={`/roleplay/${encodeURIComponent(n.code)}`}>
          Open the trainer
        </Link>,
      );
      break;
    case "area": {
      const s = areaState(n);
      facts = (
        <>
          {STATE_TEXT[s]}.{" "}
          {n.answered
            ? `${plural(n.answered, "graded answer")}, ${pct(n.correct / n.answered)} correct, ${n.seen} of ${n.questions} bank questions seen.`
            : `${plural(n.questions, "question")} in the bank, none answered yet.`}
        </>
      );
      if (n.questions > 0)
        links.push(
          <Link key="a" to={areaLink(n)}>
            Drill this area
          </Link>,
        );
      break;
    }
  }
  return (
    <div className="grid gap-2">
      <h3 className="flex flex-wrap items-baseline gap-x-2 text-title">
        <span className="text-base font-semibold text-ink-3">
          {kindLabel(n)}
        </span>
        <span className={n.kind === "event" ? "font-mono" : ""}>
          {nodeTitle(n)}
        </span>
      </h3>
      <p className="max-w-(--measure) text-ink-2">{facts}</p>
      {linked.length ? (
        <p className="text-sm text-ink-3">
          Linked to{" "}
          {linked
            .map((x) => (x.kind === "event" ? x.code : nodeTitle(x)))
            .join(", ")}
          .
        </p>
      ) : null}
      {links.length ? (
        <p className="flex flex-wrap gap-x-5 font-semibold">{links}</p>
      ) : null}
    </div>
  );
}

/** The same graph as nested lists: events, the tracks each uses, the exam's areas, every number in words. */
function MapList({ map }: { map: Graph }) {
  const shown = new Set<string>();
  const trackItem = (t: MapNode) => {
    shown.add(t.id);
    const areas =
      t.kind === "exam"
        ? map.edges
            .filter(([a]) => a === t.id)
            .map(([, b]) => map.nodes.get(b))
            .filter((x): x is AreaNode => x?.kind === "area")
        : [];
    return (
      <li key={t.id} className="grid gap-1">
        <span>
          <span className="font-semibold">
            {kindLabel(t)}: {nodeTitle(t)}
          </span>{" "}
          <span className="text-ink-2">{stats(t)}</span>
        </span>
        {areas.length ? (
          <ul className="grid gap-1 border-l border-line pl-4">
            {areas.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-2">
                <StateFacet state={areaState(a)} />
                <span className="font-semibold">{a.area}</span>
                <span className="text-ink-2">
                  {STATE_TEXT[areaState(a)]}. {stats(a)}.
                </span>
                {a.questions > 0 ? (
                  <Link
                    to={areaLink(a)}
                    className="inline-flex min-h-6 items-center text-sm font-semibold"
                    aria-label={`Drill ${a.area}`}
                  >
                    Drill
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </li>
    );
  };
  const outside = map.columns.tracks
    .map((id) => map.nodes.get(id))
    .filter((n): n is MapNode => n?.kind === "exam" && n.outside);
  return (
    <ul className="grid gap-6">
      {map.columns.events.map((id) => {
        const e = map.nodes.get(id);
        if (e?.kind !== "event") return null;
        const tracks = map.edges
          .filter(([a]) => a === id)
          .map(([, b]) => map.nodes.get(b))
          .filter((x): x is MapNode => Boolean(x));
        return (
          <li key={id} className="grid gap-2">
            <h3 className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold">
              <FacetMarker cluster={e.cluster} />
              <span className="font-mono">{e.code}</span> {e.name}
              {e.main ? <Tag tone="accent">Main event</Tag> : null}
            </h3>
            {tracks.length ? (
              <ul className="grid gap-2 pl-4">{tracks.map(trackItem)}</ul>
            ) : (
              <p className="pl-4 text-ink-2">
                No exam, deck or trainer on this site for this event (
                {componentsLine(e.components).toLowerCase()}).
              </p>
            )}
          </li>
        );
      })}
      {outside.length ? (
        <li className="grid gap-2">
          <h3 className="text-lg font-semibold">
            Practised outside your events
          </h3>
          <ul className="grid gap-2 pl-4">{outside.map(trackItem)}</ul>
        </li>
      ) : null}
    </ul>
  );
}

const LEGEND: AreaState[] = ["untouched", "thin", "weak", "steady", "strong"];

export function StrategyMap({ map }: { map: Graph }) {
  const first = map.columns.events[0] ?? null;
  const [selected, setSelected] = useState<string | null>(first);
  if (map.columns.events.length === 0)
    return (
      <EmptyState
        headingLevel={3}
        title="No events to map yet"
        body="Pick the events you compete in. The map then links each one to its exam, vocab deck and role-play trainer, and to the exam's instructional areas."
        action={<Link to="/me/settings#events">Pick events</Link>}
      />
    );
  return (
    <Tabs
      label="Strategy map view"
      tabs={[
        {
          id: "map",
          label: "Map",
          panel: (
            <div className="grid gap-6 pt-6">
              <DrawnMap
                map={map}
                selected={selected}
                onSelect={(id) => setSelected((s) => (s === id ? null : id))}
              />
              <ul
                aria-label="Area colours"
                className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-ink-2"
              >
                {LEGEND.map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    <StateFacet state={s} />
                    {STATE_TEXT[s]}
                  </li>
                ))}
              </ul>
              <section
                aria-label="Selected on the map"
                aria-live="polite"
                className="border-t border-line pt-5"
              >
                <Detail map={map} id={selected} />
              </section>
            </div>
          ),
        },
        {
          id: "list",
          label: "List",
          panel: (
            <div className="pt-6">
              <MapList map={map} />
            </div>
          ),
        },
      ]}
    />
  );
}
