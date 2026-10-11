// Shared pieces of the owner console: the data source (the real owner RPCs, or fixtures in the dev gallery), the
// loaders, and the formatting that keeps withheld counts visible as "Hidden" instead of a fake zero.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  AuditPage,
  FeedbackPatch,
  FeedbackSaved,
  ImportKind as ServerImportKind,
  OwnerContent,
  OwnerEngagement,
  OwnerFeedbackList,
  OwnerGrowth,
  OwnerOverview,
  OwnerPreparation,
  OwnerQuestion,
  OwnerUserRow,
} from "../../api/owner";
import { Button } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { Skeleton } from "../../components/ui/Skeleton";
import type { CurrentDetails, ImportKind } from "../../lib/contentImport";
import type { VocabTerm } from "../../lib/content";
import type { FeedbackFilter, FeedbackKind } from "../../lib/feedback";
import {
  countLabel,
  loadPages,
  mergePage,
  NO_DATA,
  type Bucket,
  type Count,
} from "../../lib/owner";

/** Everything the console reads or changes. OwnerPage passes the real RPCs; the dev gallery passes fixtures. */
export type OwnerSource = {
  overview(): Promise<OwnerOverview>;
  growth(days: number, bucket: Bucket): Promise<OwnerGrowth>;
  engagement(days: number): Promise<OwnerEngagement>;
  preparation(days: number): Promise<OwnerPreparation>;
  content(): Promise<OwnerContent>;
  question(id: string): Promise<OwnerQuestion>;
  /** A vocab term as members see it (terms have no hidden key, so the public read is enough). */
  term(deck: string, id: string): Promise<VocabTerm | null>;
  feedbackList(opts: {
    status?: FeedbackFilter;
    kind?: FeedbackKind | null;
    limit?: number;
    offset?: number;
  }): Promise<OwnerFeedbackList>;
  feedbackUpdate(id: string, patch: FeedbackPatch): Promise<FeedbackSaved>;
  auditSearch(opts: {
    days?: number;
    action?: string | null;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<AuditPage>;
  userSearch(query: string): Promise<OwnerUserRow[]>;
  supportEmail(userId: string, reason: string): Promise<string | null>;
  setLeaderboardHidden(
    userId: string,
    hidden: boolean,
    reason: string,
  ): Promise<{ changed: boolean }>;
  setRetired(
    kind: "question" | "term",
    ids: string[],
    retired: boolean,
    reason: string,
  ): Promise<{ changed: number }>;
  contentDetails(
    kind: ImportKind,
    slug: string,
  ): Promise<CurrentDetails | null>;
  existingIds(kind: ImportKind, slug: string): Promise<string[]>;
  importContent(
    kind: ServerImportKind,
    doc: unknown,
    reason: string,
  ): Promise<Record<string, unknown>>;
};

const SourceCtx = createContext<OwnerSource | null>(null);
/** Told when a section's data arrives (true) or fails (false), so the header's "Updated" time is honest. */
const ReportCtx = createContext<((ok: boolean) => void) | null>(null);

export function OwnerSourceProvider({
  source,
  onLoad,
  children,
}: {
  source: OwnerSource;
  onLoad?: (ok: boolean) => void;
  children: ReactNode;
}) {
  return (
    <SourceCtx.Provider value={source}>
      <ReportCtx.Provider value={onLoad ?? null}>{children}</ReportCtx.Provider>
    </SourceCtx.Provider>
  );
}

export function useOwnerSource(): OwnerSource {
  const s = useContext(SourceCtx);
  if (!s)
    throw new Error("useOwnerSource must be used inside <OwnerSourceProvider>");
  return s;
}

function useReport(): (ok: boolean) => void {
  const fn = useContext(ReportCtx);
  const ref = useRef(fn);
  ref.current = fn;
  return useCallback((ok: boolean) => ref.current?.(ok), []);
}

export type Loaded<T> = {
  data: T | null;
  error: unknown;
  loading: boolean;
  reload: () => void;
};

/**
 * Runs `fn` whenever `key` changes (and on reload), keeping the last data while a new load runs. A `quiet` load (a
 * detail inside a section) does not move the console's "Updated" time.
 */
export function useLoad<T>(
  fn: () => Promise<T>,
  key: string,
  opts?: { quiet?: boolean },
): Loaded<T> {
  const [state, setState] = useState<{
    data: T | null;
    error: unknown;
    loading: boolean;
  }>({ data: null, error: null, loading: true });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const loud = useReport();
  const quiet = !!opts?.quiet;

  useEffect(() => {
    let live = true;
    const report = quiet ? () => {} : loud;
    setState((s) => ({ ...s, loading: true, error: null }));
    fnRef
      .current()
      .then((data) => {
        if (!live) return;
        setState({ data, error: null, loading: false });
        report(true);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState((s) => ({ data: s.data, error, loading: false }));
        report(false);
      });
    return () => {
      live = false;
    };
  }, [key, nonce, loud, quiet]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

export type Paged<T, P> = Loaded<P> & {
  rows: T[];
  total: number;
  canMore: boolean;
  more: () => void;
  moreLoading: boolean;
  moreError: unknown;
};

/**
 * A list read page by page (the owner RPCs cap a page at 200 rows). A new `key` starts over; reload() reads again up
 * to the rows already on screen, so a save does not drop what the owner scrolled to.
 */
export function usePaged<T, P extends { total: number; rows: T[] }>(
  fetchPage: (offset: number) => Promise<P>,
  key: string,
  idOf: (row: T) => string | number,
): Paged<T, P> {
  type S = {
    key: string;
    head: P | null;
    rows: T[];
    total: number;
    done: boolean;
    error: unknown;
    loading: boolean;
  };
  const [st, setSt] = useState<S>({
    key,
    head: null,
    rows: [],
    total: 0,
    done: false,
    error: null,
    loading: true,
  });
  const [more, setMore] = useState<{ loading: boolean; error: unknown }>({
    loading: false,
    error: null,
  });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fetchPage);
  fnRef.current = fetchPage;
  const idRef = useRef(idOf);
  idRef.current = idOf;
  const stRef = useRef(st);
  stRef.current = st;
  const report = useReport();

  useEffect(() => {
    let live = true;
    const prev = stRef.current;
    const want = prev.key === key ? prev.rows.length : 0;
    setSt((s) => ({ ...s, loading: true, error: null }));
    setMore({ loading: false, error: null });
    loadPages(fnRef.current, want, idRef.current)
      .then((r) => {
        if (!live) return;
        setSt({
          key,
          head: r.head,
          rows: r.rows,
          total: r.total,
          done: r.done,
          error: null,
          loading: false,
        });
        report(true);
      })
      .catch((error: unknown) => {
        if (!live) return;
        setSt((s) => ({ ...s, error, loading: false }));
        report(false);
      });
    return () => {
      live = false;
    };
  }, [key, nonce, report]);

  const loadMore = useCallback(() => {
    const at = stRef.current;
    setMore({ loading: true, error: null });
    fnRef
      .current(at.rows.length)
      .then((page) => {
        setSt((s) => {
          if (s.key !== at.key) return s;
          const m = mergePage(s.rows, page.rows, idRef.current);
          return {
            ...s,
            rows: m.rows,
            total: page.total,
            done: m.added === 0 || m.rows.length >= page.total,
          };
        });
        setMore({ loading: false, error: null });
      })
      .catch((error: unknown) => setMore({ loading: false, error }));
  }, []);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const current = st.key === key;
  return {
    data: current ? st.head : null,
    error: st.error,
    loading: st.loading || !current,
    reload,
    rows: current ? st.rows : [],
    total: st.total,
    canMore: current && !st.done && st.rows.length < st.total,
    more: loadMore,
    moreLoading: more.loading,
    moreError: more.error,
  };
}

/** "Show more" for a paged list: gone at the end of the list. */
export function MoreButton({
  state,
}: {
  state: Pick<
    Paged<unknown, never>,
    "rows" | "total" | "canMore" | "more" | "moreLoading" | "moreError"
  >;
}) {
  if (!state.canMore) return null;
  const left = state.total - state.rows.length;
  return (
    <div className="mt-4 grid justify-items-start gap-2">
      <Button variant="secondary" busy={state.moreLoading} onClick={state.more}>
        {state.moreError
          ? "Try again"
          : `Show more (${left.toLocaleString("en-CA")} left)`}
      </Button>
      {state.moreError != null ? (
        <p role="alert" className="text-sm text-bad">
          Could not load more. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}

const errorText = (e: unknown) =>
  e instanceof Error && e.message ? e.message : "Something went wrong.";

/** Skeleton, error with retry, or the content (dimmed while a newer load runs). */
export function LoadState<T>({
  state,
  children,
  skeleton = "tiles",
}: {
  state: Loaded<T>;
  children: (data: T) => ReactNode;
  skeleton?: "tiles" | "chart" | "table";
}) {
  if (state.error)
    return (
      <ErrorState
        title="This section did not load"
        body={errorText(state.error)}
        onRetry={state.reload}
        retrying={state.loading}
        headingLevel={3}
      />
    );
  if (state.data)
    return (
      <div
        aria-busy={state.loading || undefined}
        className={`transition-opacity duration-(--dur-2) ${state.loading ? "opacity-60" : ""}`}
      >
        {children(state.data)}
      </div>
    );
  return <SectionSkeleton kind={skeleton} />;
}

function SectionSkeleton({ kind }: { kind: "tiles" | "chart" | "table" }) {
  return (
    <div role="status" aria-label="Loading" className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {kind === "tiles" ? (
        <div className="grid grid-cols-2 gap-6 border-y border-line py-5 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <span key={i} className="grid grid-cols-[minmax(0,1fr)] gap-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-10 w-20" />
            </span>
          ))}
        </div>
      ) : null}
      {kind === "chart" ? <Skeleton className="h-64" /> : null}
      {kind !== "chart"
        ? Array.from({ length: kind === "table" ? 6 : 3 }, (_, i) => (
            <Skeleton key={i} className="h-11" />
          ))
        : null}
    </div>
  );
}

const intFmt = new Intl.NumberFormat("en-CA");

/** A missing figure: a muted dash, read as `label` by a screen reader. */
export function EmptyValue({ label = "No figure" }: { label?: string }) {
  return (
    <span className="text-ink-3">
      <span aria-hidden="true">{NO_DATA}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A number that may be null because its group was hidden, or missing. */
export function num(n: number | null | undefined): string {
  return n == null ? NO_DATA : intFmt.format(n);
}

/** A figure string that may be the no-data dash. */
export function OrEmpty({ text }: { text: string }) {
  return text === NO_DATA ? <EmptyValue /> : <>{text}</>;
}

export const HIDDEN_WHY =
  "Hidden for privacy: fewer than 5 people, or a number that would reveal a group that small";

/** A Count, with "Hidden" in muted type when withheld. */
export function CountText({
  c,
  className = "",
}: {
  c: Count | null | undefined;
  className?: string;
}) {
  const hidden = !!c?.suppressed;
  if (!c || (!hidden && c.value == null)) return <EmptyValue />;
  return (
    <span
      className={`tabular-nums ${hidden ? "text-ink-3" : ""} ${className}`}
      title={hidden ? HIDDEN_WHY : undefined}
    >
      {countLabel(c)}
    </span>
  );
}

/** "12 members", or "members hidden" when the count is withheld. */
export function Members({ c }: { c: Count }) {
  if (c.suppressed)
    return (
      <span className="text-ink-3" title={HIDDEN_WHY}>
        a hidden number of members
      </span>
    );
  if (c.value == null) return <EmptyValue />;
  return (
    <>
      <CountText c={c} className="font-semibold text-ink" />{" "}
      {c.value === 1 ? "member" : "members"}
    </>
  );
}

/** The one-line privacy rule, under every section that counts people. */
export function PrivacyNote() {
  return (
    <p className="text-sm text-ink-3">
      <span className="font-semibold text-ink-2">Hidden</span> means fewer than
      5 people, or a number that would let someone work out a group that small.
    </p>
  );
}

/** A titled block of the console: a hairline panel with an h3, an optional line under it and actions. */
export function Block({
  title,
  lede,
  actions,
  children,
  className = "",
}: {
  title: string;
  lede?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={id}
      className={`min-w-0 rounded border border-line bg-surface p-4 sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 id={id} className="text-base font-semibold text-ink">
            {title}
          </h3>
          {lede ? <p className="mt-0.5 text-sm text-ink-3">{lede}</p> : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * A chart with its numbers one press away: "Show as table" opens a real table (scope headers) under it. The chart
 * itself also carries a visually hidden table for screen readers.
 */
export function ChartFigure({
  title,
  lede,
  table,
  children,
}: {
  title: string;
  lede?: ReactNode;
  table: { columns: string[]; rows: string[][] };
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const tableId = useId();
  return (
    <Block
      title={title}
      lede={lede}
      actions={
        <Button
          variant="quiet"
          size="sm"
          aria-expanded={open}
          aria-controls={tableId}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Hide table" : "Show as table"}
        </Button>
      }
    >
      {children}
      <div id={tableId} hidden={!open} className="mt-4">
        {open ? (
          <div className="max-h-72 overflow-auto rounded border border-line">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-surface-2 text-micro font-semibold text-ink-2">
                <tr>
                  {table.columns.map((c, i) => (
                    <th
                      key={c}
                      scope="col"
                      className={`h-9 px-3 ${i ? "text-right" : ""}`}
                    >
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((cell, j) =>
                      j === 0 ? (
                        <th
                          key={j}
                          scope="row"
                          className="h-9 px-3 font-normal text-ink-2"
                        >
                          {cell}
                        </th>
                      ) : (
                        <td
                          key={j}
                          className={`h-9 px-3 text-right font-mono tabular-nums ${cell === "Hidden" ? "text-ink-3" : "text-ink"}`}
                        >
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Block>
  );
}

const whenFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** "Oct 11, 3:04 p.m." in Toronto time. */
export function when(iso: string | null | undefined): string {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? NO_DATA : whenFmt.format(d);
}

/** "Oct 11, 2026" in Toronto time. */
export function dateOnly(iso: string | null | undefined): string {
  if (!iso) return NO_DATA;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? NO_DATA : dateFmt.format(d);
}

/** Debounced copy of a value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

export { errorText };
