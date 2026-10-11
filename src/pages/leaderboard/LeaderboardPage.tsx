import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  leaderboard,
  type Leaderboard,
  type LeaderboardRow,
} from "../../api/leaderboard";
import { saveProfile } from "../../api/profile";
import { bankSummary } from "../../api/questions";
import { Button, buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { FilterChips } from "../../components/ui/Navigation";
import { Notice } from "../../components/ui/Notice";
import { PageHeader } from "../../components/ui/PageHeader";
import { SkeletonText } from "../../components/ui/Skeleton";
import type { ExamSlug } from "../../lib/content";
import { examTitles, pct, plural } from "../../lib/format";
import { setMyProfile, useMyProfile } from "../../lib/profile";
import { useLoad } from "../../lib/useLoad";

/** Below this many listed players the board stays closed: a ranking of two or three people is not a ranking. */
export const MIN_BOARD = 5;
const PAGE = 50;

function Standing({
  board,
  onChanged,
}: {
  board: Leaderboard;
  onChanged: () => void;
}) {
  const me = board.me;
  const { profile } = useMyProfile();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setPublic(isPublic: boolean) {
    setBusy(true);
    setError(null);
    try {
      setMyProfile(await saveProfile({ is_public: isPublic }));
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not change that.");
    } finally {
      setBusy(false);
    }
  }

  let body: ReactNode;
  if (!me?.has_profile || !profile)
    body = (
      <>
        <p>
          Set up your DECA profile first. You stay private unless you choose to
          be listed.
        </p>
        <Link
          to="/onboarding?next=%2Fleaderboard"
          className={buttonClass("secondary")}
        >
          Set up my profile
        </Link>
      </>
    );
  else if (me.hidden_by_owner)
    body = (
      <p>
        The site owner has hidden your name from the board. Your practice still
        counts for you.
      </p>
    );
  else if (!me.is_public)
    body = (
      <>
        <p>
          You are private, so you are not listed. If you join, members see your
          display name, username, main event, rating, questions answered,
          accuracy and streak. Never your email, school or grade.
        </p>
        <Button variant="secondary" busy={busy} onClick={() => setPublic(true)}>
          {busy ? "Saving" : "List me on the board"}
        </Button>
      </>
    );
  else
    body = (
      <>
        <p>
          {me.rank
            ? `You are listed: number ${me.rank} of ${board.total}${board.exam ? " in this exam" : ""}.`
            : board.exam
              ? "You are listed, but you have no graded answers in this exam yet."
              : "You are listed. You show up once you have a graded answer."}
        </p>
        <Button variant="quiet" busy={busy} onClick={() => setPublic(false)}>
          {busy ? "Saving" : "Go private"}
        </Button>
      </>
    );

  return (
    <section
      aria-label="Your standing"
      className="grid gap-3 border-y border-line py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
    >
      <div className="grid gap-3 sm:contents [&>p]:max-w-(--measure) [&>p]:text-ink-2">
        {body}
      </div>
      {error ? (
        <div className="sm:col-span-2">
          <Notice tone="error">{error}</Notice>
        </div>
      ) : null}
    </section>
  );
}

function Row({ r }: { r: LeaderboardRow }) {
  return (
    <tr className={`border-b border-line ${r.is_me ? "bg-surface-2" : ""}`}>
      <td className="py-3 pr-3 text-right font-mono font-semibold tabular-nums">
        {r.rank}
      </td>
      <th scope="row" className="py-3 pr-4 text-left font-normal">
        <span className="font-semibold">{r.display_name}</span>
        {r.is_me ? (
          <span className="ml-2 text-sm font-semibold text-link">You</span>
        ) : null}
        <span className="block font-mono text-sm text-ink-3">
          @{r.username}
        </span>
      </th>
      <td className="hidden py-3 pr-4 font-mono text-sm sm:table-cell">
        {r.main_event ?? ""}
      </td>
      <td className="py-3 pr-4 text-right font-mono font-semibold tabular-nums">
        {r.elo}
      </td>
      <td className="hidden py-3 pr-4 text-right font-mono tabular-nums md:table-cell">
        {r.answered}
      </td>
      <td className="py-3 pr-4 text-right font-mono tabular-nums">
        {pct(r.accuracy)}
      </td>
      <td className="hidden py-3 text-right font-mono tabular-nums md:table-cell">
        {r.current_streak}
      </td>
    </tr>
  );
}

export function LeaderboardPage() {
  const [exam, setExam] = useState<ExamSlug | null>(null);
  const [extra, setExtra] = useState<LeaderboardRow[]>([]);
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle");
  const board = useLoad(() => {
    setExtra([]);
    return leaderboard({ exam, limit: PAGE });
  }, [exam]);
  const bank = useLoad(bankSummary, []);
  const titles = examTitles(bank.data);

  async function loadMore(b: Leaderboard) {
    setMore("loading");
    try {
      const next = await leaderboard({
        exam,
        limit: PAGE,
        offset: b.rows.length + extra.length,
      });
      setExtra((x) => [...x, ...next.rows]);
      setMore("idle");
    } catch {
      setMore("error");
    }
  }

  const chips = [
    { id: "all", label: "Overall" },
    ...(bank.data ?? []).map((b) => ({ id: b.exam, label: b.title })),
  ];

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        lede="Only members who chose to be listed, ranked by rating from their first answer to each question. No sample players, ever."
      />
      <div className="mt-8 grid gap-6">
        {board.data ? (
          <Standing board={board.data} onChanged={board.reload} />
        ) : null}
        {bank.data && bank.data.length > 0 ? (
          <FilterChips
            label="Board"
            chips={chips}
            value={[exam ?? "all"]}
            onChange={([id]) =>
              setExam(!id || id === "all" ? null : (id as ExamSlug))
            }
          />
        ) : null}
        {board.status === "error" ? (
          <ErrorState
            title="The leaderboard did not load"
            body={board.error}
            onRetry={board.reload}
          />
        ) : !board.data ? (
          <SkeletonText
            lines={5}
            label="Loading the leaderboard"
            className="max-w-2xl"
          />
        ) : board.data.total < MIN_BOARD ? (
          <EmptyState
            title={
              board.data.total === 0
                ? "Nobody is listed yet"
                : "Not enough players to rank yet"
            }
            body={
              <>
                <p>
                  {board.data.total === 0
                    ? "No member has joined the board"
                    : `${plural(board.data.total, "member")} ${board.data.total === 1 ? "has" : "have"} joined the board`}
                  {exam ? ` with answers in ${titles[exam]}` : ""}. It opens at{" "}
                  {MIN_BOARD}, so the ranking means something. Nobody here is a
                  placeholder or a sample.
                </p>
              </>
            }
          />
        ) : (
          <div className="grid gap-4">
            <table className="w-full max-w-4xl">
              <caption className="sr-only">
                {exam ? `${titles[exam]} leaderboard` : "Overall leaderboard"},{" "}
                {board.data.total} listed players
              </caption>
              <thead>
                <tr className="border-b border-line-strong text-micro font-semibold text-ink-3">
                  <th scope="col" className="w-12 py-2 pr-3 text-right">
                    Rank
                  </th>
                  <th scope="col" className="py-2 pr-4 text-left">
                    Player
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2 pr-4 text-left sm:table-cell"
                  >
                    Event
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Rating
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2 pr-4 text-right md:table-cell"
                  >
                    Answered
                  </th>
                  <th scope="col" className="py-2 pr-4 text-right">
                    Accuracy
                  </th>
                  <th
                    scope="col"
                    className="hidden py-2 text-right md:table-cell"
                  >
                    Streak
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...board.data.rows, ...extra].map((r) => (
                  <Row key={r.username} r={r} />
                ))}
              </tbody>
            </table>
            {board.data.rows.length + extra.length < board.data.total ? (
              <div className="flex items-center gap-4">
                <Button
                  variant="secondary"
                  busy={more === "loading"}
                  onClick={() => loadMore(board.data!)}
                >
                  {more === "loading" ? "Loading" : "Show more players"}
                </Button>
                {more === "error" ? (
                  <span className="text-sm text-bad">
                    Did not load. Try again.
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
