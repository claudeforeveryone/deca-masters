import type { User } from "@supabase/supabase-js";
import { Check, LayoutList, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { listBookmarks } from "../../api/bookmarks";
import { boardLayoutOf, saveBoardLayout } from "../../api/dashboard";
import { listEvents } from "../../api/events";
import { goalProgress } from "../../api/goals";
import { openRuns, weakSpots } from "../../api/practice";
import type { Profile } from "../../api/profile";
import { myStats, runHistory } from "../../api/progress";
import { bankSummary } from "../../api/questions";
import { mySessions } from "../../api/roleplay";
import { vocabSummary } from "../../api/vocab";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { Button, buttonClass } from "../../components/ui/Button";
import { ErrorState } from "../../components/ui/EmptyState";
import { PageHeader } from "../../components/ui/PageHeader";
import { Skeleton } from "../../components/ui/Skeleton";
import { FacetMarker } from "../../components/ui/Tag";
import { useAuth } from "../../lib/auth";
import {
  DEFAULT_LAYOUT,
  moveModule,
  sameLayout,
  toggleOpen,
  type BoardLayout,
  type ModuleId,
} from "../../lib/board";
import { dailyRunToday, splitAreas } from "../../lib/dashboard";
import { examTitles } from "../../lib/format";
import { torontoToday } from "../../lib/leitner";
import { useMyProfile } from "../../lib/profile";
import { recommendNext, type NextAction } from "../../lib/recommend";
import { useLoad } from "../../lib/useLoad";
import { Board } from "./board/Board";
import { buildViews, type BoardData } from "./board/modules";

/** The signed-in home: the next action, then the member's board of modules in their own order. */
export function CommandCentre() {
  const { user } = useAuth();
  const me = useMyProfile();
  if (me.status === "error")
    return (
      <ErrorState
        headingLevel={1}
        title="Your board did not load"
        body={me.error ?? "Check your connection and try again."}
        onRetry={me.reload}
      />
    );
  if (me.status !== "ready" || !user)
    return <RouteFallback label="Loading your board" />;
  if (!me.profile) return <Navigate to="/onboarding" replace />;
  return <Centre profile={me.profile} user={user} />;
}

type SaveState = "idle" | "saving" | "saved" | "error";

function useSavedLayout(user: User) {
  const [layout, setLayout] = useState<BoardLayout>(() => boardLayoutOf(user));
  const [save, setSave] = useState<SaveState>("idle");
  const saved = useRef(layout);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (sameLayout(layout, saved.current)) return;
    const t = window.setTimeout(() => {
      setSave("saving");
      saveBoardLayout(layout).then(
        () => {
          saved.current = layout;
          setSave("saved");
        },
        () => setSave("error"),
      );
    }, 700);
    return () => window.clearTimeout(t);
  }, [layout, retry]);

  return {
    layout,
    setLayout,
    save,
    retrySave: () => setRetry((n) => n + 1),
  };
}

function Centre({ profile, user }: { profile: Profile; user: User }) {
  const today = torontoToday();
  const stats = useLoad(myStats, []);
  const open = useLoad(openRuns, []);
  const weak = useLoad(() => weakSpots(), []);
  const vocab = useLoad(vocabSummary, []);
  const goals = useLoad(goalProgress, []);
  const saved = useLoad(() => listBookmarks(), []);
  const events = useLoad(listEvents, []);
  const bank = useLoad(bankSummary, []);
  const runs = useLoad(() => runHistory({ limit: 30 }), []);
  const sessions = useLoad(() => mySessions({ limit: 5 }), []);
  const { layout, setLayout, save, retrySave } = useSavedLayout(user);
  const [arranging, setArranging] = useState(false);

  const data: BoardData = {
    today,
    profile,
    stats,
    open,
    weak,
    vocab,
    goals,
    saved,
    events,
    bank,
    runs,
    sessions,
  };
  const views = buildViews(data, (id) =>
    setLayout((l) =>
      l.open.includes(id) ? l : { ...l, open: [...l.open, id] },
    ),
  );

  const mainEvent = events.data?.find((e) => e.code === profile.events[0]);
  const nextLoads = [stats, open, vocab, weak, events, bank];
  const nextFailed = nextLoads.some((l) => l.status === "error");
  const next = useMemo<NextAction | null>(() => {
    if (nextLoads.some((l) => l.data === undefined)) return null;
    const byCode = new Map((events.data ?? []).map((e) => [e.code, e]));
    return recommendNext({
      today,
      events: profile.events.flatMap((c) => {
        const e = byCode.get(c);
        return e
          ? [
              {
                code: e.code,
                name: e.name,
                exam: e.exam,
                components: e.components,
              },
            ]
          : [];
      }),
      examTitles: examTitles(bank.data),
      openRuns: open.data ?? [],
      answered: stats.data?.questions_answered ?? 0,
      vocab: (vocab.data ?? []).map((v) => ({
        deck: v.deck,
        title: v.title,
        due: v.due,
      })),
      dailyDone: Boolean(dailyRunToday(stats.data?.recent_runs ?? [], today)),
      weakest: splitAreas(weak.data ?? [], 5, 1).weakest[0] ?? null,
      roleplayLastAt: Object.fromEntries(
        (stats.data?.roleplay.by_event ?? []).map((r) => [
          r.event_code,
          r.last_at,
        ]),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stats.data,
    open.data,
    vocab.data,
    weak.data,
    events.data,
    bank.data,
    profile.events,
    today,
  ]);

  function move(id: ModuleId, to: number) {
    setLayout((l) => ({ ...l, order: moveModule(l.order, id, to) }));
  }

  return (
    <div>
      <PageHeader
        title="Command centre"
        lede={
          <>
            Hi {profile.display_name}.{" "}
            {mainEvent ? (
              <>
                Main event:{" "}
                <span className="font-mono text-ink">{mainEvent.code}</span>{" "}
                {mainEvent.name}.
              </>
            ) : (
              "Pick your events to fill in the board."
            )}
          </>
        }
      />

      <NextUp
        next={next}
        failed={nextFailed}
        onRetry={() =>
          nextLoads
            .filter((l) => l.status === "error")
            .forEach((l) => l.reload())
        }
      />

      <section aria-labelledby="board-heading" className="mt-12">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div>
            <h2 id="board-heading" className="text-title">
              Your board
            </h2>
            <p className="mt-1 text-sm text-ink-2">
              {arranging
                ? "Drag a row by its handle, or use the arrows. Your order is saved to your account."
                : "Open a row for details. Arrange it in the order you use it."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SaveStatus state={save} onRetry={retrySave} />
            {arranging &&
            !sameLayout(
              { ...layout, open: [] },
              { ...DEFAULT_LAYOUT, open: [] },
            ) ? (
              <Button
                variant="quiet"
                onClick={() =>
                  setLayout((l) => ({ ...l, order: [...DEFAULT_LAYOUT.order] }))
                }
              >
                <RotateCcw aria-hidden="true" className="size-4" />
                Reset order
              </Button>
            ) : null}
            <Button
              variant={arranging ? "primary" : "secondary"}
              aria-pressed={arranging}
              onClick={() => setArranging((a) => !a)}
            >
              {arranging ? (
                <>
                  <Check aria-hidden="true" className="size-4.5" />
                  Done
                </>
              ) : (
                <>
                  <LayoutList aria-hidden="true" className="size-4.5" />
                  Arrange
                </>
              )}
            </Button>
          </div>
        </div>
        <Board
          views={layout.order.map((id) => views[id])}
          open={layout.open}
          onToggle={(id) => setLayout((l) => toggleOpen(l, id))}
          arranging={arranging}
          onMove={move}
        />
      </section>
    </div>
  );
}

function SaveStatus({
  state,
  onRetry,
}: {
  state: SaveState;
  onRetry: () => void;
}) {
  if (state === "error")
    return (
      <p role="alert" className="flex items-center gap-2 text-sm text-bad">
        Layout not saved.
        <button
          type="button"
          onClick={onRetry}
          className="min-h-11 font-semibold text-link underline-offset-4 hover:underline"
        >
          Try again
        </button>
      </p>
    );
  return (
    <p aria-live="polite" className="text-sm text-ink-3">
      {state === "saving"
        ? "Saving layout"
        : state === "saved"
          ? "Layout saved"
          : ""}
    </p>
  );
}

/** The one recommended next step, with the reason from the member's own numbers. */
function NextUp({
  next,
  failed,
  onRetry,
}: {
  next: NextAction | null;
  failed: boolean;
  onRetry: () => void;
}) {
  if (failed)
    return (
      <div className="mt-8">
        <ErrorState
          title="Next up could not be worked out"
          body="Part of your record did not load, so there is no recommendation yet."
          onRetry={onRetry}
        />
      </div>
    );
  return (
    <section
      aria-labelledby="next-heading"
      className="mt-8 grid gap-x-10 gap-y-4 border-y border-line-strong py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="min-w-0">
        <h2
          id="next-heading"
          className="flex items-center gap-2.5 text-sm font-semibold text-ink-2"
        >
          <FacetMarker tone="electric" />
          Next up
        </h2>
        {next ? (
          <>
            <p className="mt-2 font-display text-title leading-tight font-bold text-ink">
              {next.title}
            </p>
            <p className="mt-1.5 max-w-(--measure) text-ink-2">{next.why}</p>
          </>
        ) : (
          <span
            role="status"
            aria-label="Working out your next step"
            className="mt-3 grid gap-2"
          >
            <Skeleton className="h-7 w-2/3 max-w-md" />
            <Skeleton className="h-4 w-1/2 max-w-sm" />
          </span>
        )}
      </div>
      {next ? (
        <Link
          to={next.to}
          className={buttonClass("primary", "w-full sm:w-auto", "lg")}
        >
          {next.cta}
        </Link>
      ) : null}
      <details className="text-sm text-ink-3 sm:col-span-2">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-ink-2 hover:text-ink">
          How this is picked
        </summary>
        <p className="max-w-(--measure) pb-1">
          From your own records, first match wins: pick your events, finish an
          unfinished run, review due vocab, get a first graded set, do the daily
          10, drill an area under 70% (5+ answers), run a role play for your
          main event if none in 7 days, then keep practising your main exam.
          Nothing here predicts a score.
        </p>
      </details>
    </section>
  );
}
