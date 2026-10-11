// Scale and tick maths for the SVG chart primitives. Pure, tested, no chart library.

/** Rounds away float noise (0.30000000000000004 -> 0.3). */
function clean(n: number): number {
  return Number.parseFloat(n.toPrecision(12));
}

/** Round tick values that cover [min, max] in about `count` steps (1, 2 or 5 times a power of ten). */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [clean(min)];
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  const raw = (hi - lo) / Math.max(1, count);
  const power = Math.floor(Math.log10(raw));
  const base = 10 ** power;
  const error = raw / base;
  const factor =
    error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1;
  const step = factor * base;
  const start = Math.floor(clean(lo / step));
  const end = Math.ceil(clean(hi / step));
  const ticks: number[] = [];
  for (let i = start; i <= end; i++) ticks.push(clean(i * step));
  return ticks;
}

/** Maps a value in `domain` onto `range` linearly. A flat domain maps to the middle of the range. */
export function linearScale(
  [d0, d1]: [number, number],
  [r0, r1]: [number, number],
): (v: number) => number {
  if (d0 === d1) return () => (r0 + r1) / 2;
  const k = (r1 - r0) / (d1 - d0);
  return (v) => clean(r0 + (v - d0) * k);
}

/** "M x,y L x,y ..." through the points, numbers rounded to two decimals. */
export function linePath(points: [number, number][]): string {
  const r = (n: number) => Math.round(n * 100) / 100;
  return points
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${r(x)},${r(y)}`)
    .join("");
}
