// The command centre's board: which modules exist, their default order, and the pure rules for arranging them.
// A member's arrangement is saved per account (src/api/dashboard.ts); whatever comes back from storage goes through
// normalizeLayout first, so an old or hand-edited save can never hide a module or crash the page.

export const BOARD_MODULES = [
  "continue",
  "today",
  "events",
  "areas",
  "activity",
  "streak",
  "accuracy",
  "recent",
  "saved",
] as const;
export type ModuleId = (typeof BOARD_MODULES)[number];

export type BoardLayout = {
  /** Every module, once, top to bottom. */
  order: ModuleId[];
  /** Modules whose details are expanded. */
  open: ModuleId[];
};

export const DEFAULT_LAYOUT: BoardLayout = {
  order: [...BOARD_MODULES],
  open: [],
};

const isModule = (v: unknown): v is ModuleId =>
  typeof v === "string" && (BOARD_MODULES as readonly string[]).includes(v);

function cleanIds(raw: unknown): ModuleId[] {
  if (!Array.isArray(raw)) return [];
  const out: ModuleId[] = [];
  for (const v of raw) if (isModule(v) && !out.includes(v)) out.push(v);
  return out;
}

/** A layout from storage, made whole: known modules only, each once, missing ones appended in default order. */
export function normalizeLayout(raw: unknown): BoardLayout {
  if (!raw || typeof raw !== "object") return DEFAULT_LAYOUT;
  const r = raw as { order?: unknown; open?: unknown };
  const saved = cleanIds(r.order);
  const order = [
    ...saved,
    ...BOARD_MODULES.filter((id) => !saved.includes(id)),
  ];
  return { order, open: cleanIds(r.open) };
}

/** The order with `id` moved to index `to` (clamped to the board). The same array back when `id` is not on it. */
export function moveModule<T extends string>(
  order: T[],
  id: T,
  to: number,
): T[] {
  const from = order.indexOf(id);
  if (from < 0) return order;
  const target = Math.max(0, Math.min(order.length - 1, Math.round(to)));
  if (target === from) return order;
  const next = order.filter((x) => x !== id);
  next.splice(target, 0, id);
  return next;
}

export function toggleOpen(layout: BoardLayout, id: ModuleId): BoardLayout {
  return {
    ...layout,
    open: layout.open.includes(id)
      ? layout.open.filter((x) => x !== id)
      : [...layout.open, id],
  };
}

export function sameLayout(a: BoardLayout, b: BoardLayout): boolean {
  return (
    a.order.join() === b.order.join() &&
    [...a.open].sort().join() === [...b.open].sort().join()
  );
}
