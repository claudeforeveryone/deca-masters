import { useEffect, useId, useRef, useState } from "react";
import { linearScale, linePath, niceTicks } from "./scale";

/** Width of an element, kept current with a ResizeObserver, so chart text stays at real pixel sizes. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(el.clientWidth || fallback);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry.contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, width] as const;
}

export type Point = { x: string; y: number };

/**
 * One series over time (scores per run). SVG with role="img", a title and a description, and the same numbers in
 * a visually hidden table. Direct label on the last point instead of a legend. Hairline grid, one accent line.
 */
export function LineChart({
  label,
  description,
  data,
  yMin,
  yMax,
  height = 220,
  format = (n) => String(n),
  tone = "surface",
}: {
  label: string;
  description: string;
  data: Point[];
  yMin?: number;
  yMax?: number;
  height?: number;
  format?: (n: number) => string;
  tone?: "surface" | "stage";
}) {
  const [box, width] = useWidth<HTMLDivElement>(560);
  const titleId = useId();
  const descId = useId();
  const stage = tone === "stage";
  const m = { top: 14, right: 44, bottom: 28, left: 40 };
  const ys = data.map((d) => d.y);
  const ticks = niceTicks(
    yMin ?? Math.min(...ys, 0),
    yMax ?? Math.max(...ys, 1),
    4,
  );
  const y = linearScale(
    [ticks[0], ticks[ticks.length - 1]],
    [height - m.bottom, m.top],
  );
  const x = linearScale(
    [0, Math.max(1, data.length - 1)],
    [m.left, width - m.right],
  );
  const pts = data.map((d, i) => [x(i), y(d.y)] as [number, number]);
  const every = Math.max(
    1,
    Math.ceil(data.length / Math.max(2, Math.floor(width / 72))),
  );
  const last = pts.at(-1);
  const grid = stage ? "var(--stage-line)" : "var(--line)";
  const text = stage ? "var(--on-stage-3)" : "var(--ink-3)";

  return (
    <figure ref={box} className="m-0 w-full">
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block overflow-visible"
      >
        <title id={titleId}>{label}</title>
        <desc id={descId}>{description}</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={m.left}
              x2={width - m.right}
              y1={y(t)}
              y2={y(t)}
              stroke={grid}
              strokeWidth={1}
            />
            <text
              x={m.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fill={text}
              className="font-mono text-[12px] tabular-nums"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) =>
          i === data.length - 1 ||
          (i % every === 0 && data.length - 1 - i >= every) ? (
            <text
              key={d.x}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fill={text}
              className="font-mono text-[12px]"
            >
              {d.x}
            </text>
          ) : null,
        )}
        <path
          d={linePath(pts)}
          fill="none"
          stroke="var(--electric)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        {pts.map(([px, py], i) => (
          <rect
            key={i}
            x={px - 3}
            y={py - 3}
            width={6}
            height={6}
            transform={`rotate(45 ${px} ${py})`}
            fill={
              i === pts.length - 1
                ? "var(--electric)"
                : stage
                  ? "var(--stage-1)"
                  : "var(--surface)"
            }
            stroke="var(--electric)"
            strokeWidth={1.5}
          />
        ))}
        {last ? (
          <text
            x={last[0] + 10}
            y={last[1]}
            dy="0.32em"
            fill={stage ? "var(--on-navy)" : "var(--ink)"}
            className="font-mono text-[13px] font-semibold tabular-nums"
          >
            {format(data[data.length - 1].y)}
          </text>
        ) : null}
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.x}>
              <th scope="row">{d.x}</th>
              <td>{format(d.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/**
 * Categories compared on one measure (accuracy by instructional area). Each row: label, a bar on a hairline, the
 * value right-aligned. A real list, so screen readers read label and value together.
 */
export function BarList({
  label,
  data,
  max,
  format = (n) => String(n),
  tone = "surface",
}: {
  label: string;
  /** `hidden` rows (a number withheld for privacy) show "Hidden" and a dashed stub instead of a bar. */
  data: { label: string; value: number; note?: string; hidden?: boolean }[];
  max?: number;
  format?: (n: number) => string;
  tone?: "surface" | "stage";
}) {
  const top =
    max ?? Math.max(1, ...data.filter((d) => !d.hidden).map((d) => d.value));
  const stage = tone === "stage";
  return (
    <ul aria-label={label} className="grid gap-3">
      {data.map((d) => {
        const ratio = Math.min(1, Math.max(0, d.value / top));
        return (
          <li
            key={d.label}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1.5"
          >
            <span
              className={`min-w-0 truncate text-sm ${stage ? "text-on-navy-2" : "text-ink-2"}`}
            >
              {d.label}
            </span>
            <span
              className={`font-mono text-sm tabular-nums ${d.hidden ? (stage ? "text-on-stage-3" : "text-ink-3") : `font-semibold ${stage ? "text-on-navy" : "text-ink"}`}`}
            >
              {d.hidden ? "Hidden" : format(d.value)}
            </span>
            <span aria-hidden="true" className="relative col-span-2 h-2">
              <span
                className={`absolute inset-x-0 top-1/2 h-px ${stage ? "bg-stage-line" : "bg-line"}`}
              />
              {d.hidden ? (
                <span
                  className={`absolute inset-y-0 left-0 w-6 rounded-xs border border-dashed ${stage ? "border-stage-line-strong bg-stage-1" : "border-line-strong bg-surface"}`}
                />
              ) : (
                <span
                  className="absolute inset-y-0 left-0 w-full origin-left bg-electric transition-transform duration-(--dur-4) ease-out"
                  style={{ transform: `scaleX(${ratio})` }}
                />
              )}
            </span>
            {d.note ? (
              <span
                className={`col-span-2 text-micro ${stage ? "text-on-stage-3" : "text-ink-3"}`}
              >
                {d.note}
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** A tiny trend line for inline use. Its label must say what the trend is ("Last 8 runs, 61 to 78"). */
export function Sparkline({
  values,
  label,
  width = 96,
  height = 28,
}: {
  values: number[];
  label: string;
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return null;
  const x = linearScale([0, values.length - 1], [2, width - 2]);
  const y = linearScale(
    [Math.min(...values), Math.max(...values)],
    [height - 3, 3],
  );
  const pts = values.map((v, i) => [x(i), y(v)] as [number, number]);
  const end = pts[pts.length - 1];
  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <path
        d={linePath(pts)}
        fill="none"
        stroke="var(--electric)"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      <rect
        x={end[0] - 2.5}
        y={end[1] - 2.5}
        width={5}
        height={5}
        transform={`rotate(45 ${end[0]} ${end[1]})`}
        fill="var(--electric)"
      />
    </svg>
  );
}

export type Column = {
  /** Short axis label ("Oct 5"). */
  label: string;
  /** Full name for the tooltip and the table ("Oct 5 to Oct 11, 2026"). */
  title: string;
  value: number;
  /** A number withheld for privacy: drawn as a dashed stub at the baseline and read as "Hidden", never as 0. */
  hidden?: boolean;
};

/** The top edge of a column with 2px corners and a square baseline. */
function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(2, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

/**
 * One measure per period (sign-ups per week). Columns at most 24px wide with air between them, one baseline, a
 * hairline grid, the last value labelled on its cap. Each column has a tooltip; the same numbers are in a visually
 * hidden table (and ChartFigure can show it). Hidden buckets keep their slot as a dashed stub.
 */
export function ColumnChart({
  label,
  description,
  data,
  height = 200,
  format = (n) => String(n),
}: {
  label: string;
  description: string;
  data: Column[];
  height?: number;
  format?: (n: number) => string;
}) {
  const [box, width] = useWidth<HTMLDivElement>(560);
  const titleId = useId();
  const descId = useId();
  const m = { top: 18, right: 8, bottom: 28, left: 36 };
  const shownMax = Math.max(0, ...data.filter((d) => !d.hidden).map((d) => d.value));
  const ticks = niceTicks(0, Math.max(shownMax, 4), 4);
  const top = ticks[ticks.length - 1] || 1;
  const y = linearScale([0, top], [height - m.bottom, m.top]);
  const plotW = Math.max(1, width - m.left - m.right);
  const slot = plotW / Math.max(1, data.length);
  const colW = Math.max(2, Math.min(24, slot - 2));
  const every = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(plotW / 56))));
  const lastShown = data.map((d, i) => (d.hidden ? -1 : i)).filter((i) => i >= 0).at(-1);

  return (
    <figure ref={box} className="m-0 w-full">
      <svg
        role="img"
        aria-labelledby={`${titleId} ${descId}`}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block overflow-visible"
      >
        <title id={titleId}>{label}</title>
        <desc id={descId}>{description}</desc>
        {ticks.map((t) => (
          <g key={t}>
            <line
              x1={m.left}
              x2={width - m.right}
              y1={y(t)}
              y2={y(t)}
              stroke="var(--line)"
              strokeWidth={1}
            />
            <text
              x={m.left - 8}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fill="var(--ink-3)"
              className="font-mono text-[12px] tabular-nums"
            >
              {format(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = m.left + slot * i + slot / 2;
          const x = cx - colW / 2;
          const base = y(0);
          const h = d.hidden ? 0 : Math.max(0, base - y(d.value));
          return (
            <g key={`${d.title}-${i}`}>
              <title>{`${d.title}: ${d.hidden ? "hidden for privacy" : format(d.value)}`}</title>
              {/* hit target: the whole slot, so a short or empty column still has a tooltip */}
              <rect x={m.left + slot * i} y={m.top} width={slot} height={base - m.top} fill="transparent" />
              {d.hidden ? (
                <rect
                  x={x + 0.5}
                  y={base - 10.5}
                  width={colW - 1}
                  height={10}
                  rx={1}
                  fill="var(--surface)"
                  stroke="var(--line-strong)"
                  strokeDasharray="3 2"
                />
              ) : h > 0 ? (
                <path d={columnPath(x, base - h, colW, h)} fill="var(--electric)" />
              ) : null}
              {i === lastShown && !d.hidden ? (
                <text
                  x={cx}
                  y={base - h - 6}
                  textAnchor="middle"
                  fill="var(--ink)"
                  className="font-mono text-[12px] font-semibold tabular-nums"
                >
                  {format(d.value)}
                </text>
              ) : null}
              {i === data.length - 1 ||
              (i % every === 0 && data.length - 1 - i >= every / 2) ? (
                <text
                  x={cx}
                  y={height - 8}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  className="font-mono text-[12px]"
                >
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.title}-${i}`}>
              <th scope="row">{d.title}</th>
              <td>{d.hidden ? "Hidden" : format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
