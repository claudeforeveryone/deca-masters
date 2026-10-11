import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../../api/profile";
import type { VocabTerm } from "../../lib/content";
import type { MemberState } from "../../lib/member";

const member = vi.hoisted(() => ({
  state: { status: "signed-out" } as MemberState,
}));
vi.mock("../../lib/member", async (orig) => ({
  ...(await orig<typeof import("../../lib/member")>()),
  useMember: () => ({
    state: member.state,
    reload: vi.fn(),
    setEvents: vi.fn(),
  }),
}));
vi.mock("../../api/track", () => ({ track: vi.fn(async () => {}) }));
// The report dialog asks who is signed in; reports go to the sink the provider is given.
vi.mock("../../lib/auth", () => ({
  useAuth: () => ({ loading: false, user: { id: "u1" } }),
}));
vi.mock("../../api/vocab", async (orig) => ({
  ...(await orig<typeof import("../../api/vocab")>()),
  getDeck: vi.fn(),
  listTerms: vi.fn(),
  myReviews: vi.fn(),
  submitReviews: vi.fn(),
}));

import { getDeck, listTerms, myReviews, submitReviews } from "../../api/vocab";
import {
  FeedbackProvider,
  type FeedbackSink,
} from "../../components/feedback/Feedback";
import { ToastProvider } from "../../components/ui/Toast";
import { DeckPage } from "./DeckPage";

// Synthetic fixtures: the page is under test, not the content.
const SOURCE = {
  title: "Test glossary",
  url: "https://example.org/glossary",
  licence: "CC BY 4.0",
  attribution: "Example authors",
  adapted: false,
};
const TERMS: VocabTerm[] = ["A", "B", "C", "D", "E"].map((x) => ({
  id: `mkt-v-00${"ABCDE".indexOf(x) + 1}`,
  term: `Term ${x}`,
  definition: `Definition of term ${x}.`,
  area: x < "C" ? "Area one" : "Area two",
  source: SOURCE,
}));
const DECK = {
  slug: "marketing" as const,
  title: "Marketing Cluster Exam",
  status: "sourced" as const,
  placeholderNote: null,
  sources: [SOURCE],
  updatedAt: "2026-10-11T00:00:00Z",
};

function Probe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.pathname + loc.search}</output>;
}

const sink = {
  send: vi.fn(async () => {}),
  listMine: vi.fn(async () => []),
} satisfies FeedbackSink;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <FeedbackProvider sink={sink}>
          <Routes>
            <Route path="/vocab/:deck" element={<DeckPage />} />
          </Routes>
        </FeedbackProvider>
      </ToastProvider>
      <Probe />
    </MemoryRouter>,
  );
}

const advance = (ms: number) =>
  act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

/** Answers the quiz question on screen, rightly or wrongly. Returns the term that was asked. */
function answer(right: boolean): VocabTerm {
  const prompt = screen.getByText("Pick the definition of").nextElementSibling!;
  const asked = TERMS.find((t) => t.term === prompt.textContent)!;
  const options = screen
    .getAllByRole("button")
    .filter((b) => b.textContent!.includes("Definition of term"));
  expect(options).toHaveLength(4);
  const pick = options.find(
    (b) => b.textContent!.includes(asked.definition) === right,
  )!;
  fireEvent.click(pick);
  return asked;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  member.state = { status: "signed-out" };
  vi.mocked(getDeck).mockResolvedValue(DECK);
  vi.mocked(listTerms).mockResolvedValue(TERMS);
  vi.mocked(myReviews).mockResolvedValue([]);
  vi.mocked(submitReviews).mockImplementation(async (answers) =>
    answers.map((a) => ({
      term_id: a.termId,
      deck: "marketing",
      box: a.correct ? 1 : 0,
      due_at: "2026-10-12T04:00:00Z",
      correct_count: a.correct ? 1 : 0,
      wrong_count: a.correct ? 0 : 1,
      last_reviewed_at: "2026-10-11T15:00:00Z",
    })),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("vocab deck", () => {
  it("lets a visitor quiz without saving anything", async () => {
    renderAt("/vocab/marketing?mode=quiz");
    await screen.findByRole("heading", {
      level: 1,
      name: "Marketing Cluster Exam",
    });
    expect(myReviews).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Start the quiz" }));
    answer(true);
    expect(screen.getByText("Right.")).toBeTruthy();
    await advance(5000);
    expect(submitReviews).not.toHaveBeenCalled();
    expect(
      screen.getByText("Not saved: sign in to keep your progress."),
    ).toBeTruthy();
  });

  it("sends a member's quiz answers to the server in a batch", async () => {
    member.state = {
      status: "ready",
      uid: "u1",
      profile: { id: "u1", events: [] } as unknown as Profile,
    };
    renderAt("/vocab/marketing?mode=quiz");
    await screen.findByRole("button", { name: "Start the quiz" });
    expect(myReviews).toHaveBeenCalledWith("marketing");
    fireEvent.click(screen.getByRole("button", { name: "Start the quiz" }));
    const first = answer(true);
    fireEvent.click(screen.getByRole("button", { name: "Next" }));
    const second = answer(false);
    expect(screen.getByText("Saving 2 answers")).toBeTruthy();
    expect(submitReviews).not.toHaveBeenCalled();
    await advance(3000);
    expect(submitReviews).toHaveBeenCalledTimes(1);
    expect(vi.mocked(submitReviews).mock.calls[0][0]).toEqual([
      { termId: first.id, correct: true },
      { termId: second.id, correct: false },
    ]);
    expect(screen.getByText("Your answers save as you go.")).toBeTruthy();
  });

  it("keeps answers that failed to send and offers to try again", async () => {
    member.state = {
      status: "ready",
      uid: "u1",
      profile: { id: "u1", events: [] } as unknown as Profile,
    };
    vi.mocked(submitReviews).mockRejectedValueOnce(
      new Error("Network error. Check your connection and try again."),
    );
    renderAt("/vocab/marketing?mode=quiz");
    fireEvent.click(
      await screen.findByRole("button", { name: "Start the quiz" }),
    );
    const asked = answer(true);
    await advance(3000);
    expect(
      screen.getByText("Network error. Check your connection and try again."),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await advance(50);
    expect(submitReviews).toHaveBeenCalledTimes(2);
    expect(vi.mocked(submitReviews).mock.calls[1][0]).toEqual([
      { termId: asked.id, correct: true },
    ]);
  });

  it("clears a match board and leaves the review schedule alone", async () => {
    member.state = {
      status: "ready",
      uid: "u1",
      profile: { id: "u1", events: [] } as unknown as Profile,
    };
    renderAt("/vocab/marketing");
    await screen.findByRole("heading", {
      level: 1,
      name: "Marketing Cluster Exam",
    });
    fireEvent.click(screen.getByRole("tab", { name: "Match" }));
    expect(screen.getByTestId("loc").textContent).toBe(
      "/vocab/marketing?mode=match",
    );
    fireEvent.click(await screen.findByRole("button", { name: "Start" }));
    // One wrong pair first: a second is added.
    fireEvent.click(screen.getByRole("button", { name: "Term: Term A" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Definition: Definition of term B." }),
    );
    for (const t of TERMS) {
      fireEvent.click(screen.getByRole("button", { name: `Term: ${t.term}` }));
      fireEvent.click(
        screen.getByRole("button", { name: `Definition: ${t.definition}` }),
      );
    }
    await screen.findByRole("heading", { name: /^Cleared in/ });
    expect(screen.getByText("+1 s")).toBeTruthy();
    await advance(5000);
    expect(submitReviews).not.toHaveBeenCalled();
  });

  it("lists every term with its source and filters by area", async () => {
    renderAt("/vocab/marketing?mode=terms");
    await screen.findByText("Term A");
    expect(screen.getAllByRole("link", { name: /Test glossary/ }).length).toBe(
      TERMS.length + 1, // each term plus the deck's source list
    );
    fireEvent.change(
      screen.getByRole("combobox", { name: "Instructional area" }),
      {
        target: { value: "Area one" },
      },
    );
    expect(screen.queryByText("Term C")).toBeNull();
    expect(screen.getByText("Term B")).toBeTruthy();
  });

  it("reports a term from the list with the term's id attached", async () => {
    renderAt("/vocab/marketing?mode=terms");
    await screen.findByText("Term A");
    const buttons = screen.getAllByRole("button", { name: /^Report this term/ });
    expect(buttons).toHaveLength(TERMS.length);
    fireEvent.click(screen.getByRole("button", { name: "Report this term, Term B" }));
    await screen.findByRole("dialog", { name: "Report this term" });
    fireEvent.click(screen.getByRole("button", { name: "Send report" }));
    await vi.waitFor(() =>
      expect(sink.send).toHaveBeenCalledWith(
        expect.objectContaining({
          kind: "vocab_issue",
          questionId: "mkt-v-002",
          pagePath: "/vocab/marketing",
        }),
      ),
    );
  });

  it("offers the report with the feedback on a quiz answer", async () => {
    renderAt("/vocab/marketing?mode=quiz");
    fireEvent.click(await screen.findByRole("button", { name: "Start the quiz" }));
    expect(screen.queryByRole("button", { name: /^Report this term/ })).toBeNull();
    const asked = answer(false);
    expect(
      screen.getByRole("button", { name: `Report this term, ${asked.term}` }),
    ).toBeTruthy();
  });

  it("says when there is no such deck", async () => {
    renderAt("/vocab/not-a-deck");
    await screen.findByRole("heading", {
      level: 1,
      name: "No deck by that name",
    });
    expect(getDeck).not.toHaveBeenCalled();
  });
});
