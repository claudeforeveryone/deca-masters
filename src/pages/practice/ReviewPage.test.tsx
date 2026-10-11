import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../../lib/supabase",
  async () => (await import("../../test/supabaseMock")).supabaseModule,
);
vi.mock("../../api/practice", async (original) => ({
  ...(await original<typeof import("../../api/practice")>()),
  reviewRun: vi.fn(),
  startRun: vi.fn(),
}));
vi.mock("../../api/questions", async (original) => ({
  ...(await original<typeof import("../../api/questions")>()),
  bankSummary: vi.fn(),
}));
import {
  reviewRun,
  startRun,
  type GradedAnswer,
  type ReviewQuestion,
  type RunReview,
  type RunState,
} from "../../api/practice";
import { bankSummary } from "../../api/questions";
import { ToastProvider } from "../../components/ui/Toast";
import { ReviewPage } from "./ReviewPage";

const q = (id: string, area: string, retired = false): ReviewQuestion => ({
  id,
  exam: "finance",
  area,
  pi: null,
  difficulty: 1,
  stem: `Stem of ${id}?`,
  choices: ["Alpha", "Bravo", "Charlie", "Delta"],
  status: "sourced",
  retired,
  source: {
    title: "Open textbook",
    url: "https://example.org/book",
    licence: "CC BY 4.0",
    attribution: "Example authors",
    adapted: false,
  },
});
const a = (
  question_id: string,
  chosen: GradedAnswer["chosen"],
  correct: boolean,
  explanation: string | null = null,
): GradedAnswer => ({
  question_id,
  chosen,
  correct,
  correct_choice: 0,
  explanation,
  elo_delta: 0,
  ms: 3000,
  flagged: false,
});

// q1 right, q2 wrong, q3 left blank and since removed from the bank
const REVIEW: RunReview = {
  attempt_id: "a1",
  client_id: "c1",
  kind: "practice",
  exam: "finance",
  area: null,
  label: null,
  status: "submitted",
  correct: 1,
  total: 3,
  duration_ms: 95_000,
  elo_before: 1000,
  elo_after: 1012,
  timed_out: false,
  started_at: "2026-10-11T12:00:00Z",
  submitted_at: "2026-10-11T12:05:00Z",
  time_limit_sec: null,
  current_streak: 2,
  answers: [
    a("q1", 0, true),
    a("q2", 2, false, "A budget plans spending before it happens."),
    a("q3", null, false),
  ],
  questions: [
    q("q1", "Saving"),
    q("q2", "Investing"),
    q("q3", "Investing", true),
  ],
};

function Probe() {
  const { pathname, search, state } = useLocation();
  return (
    <p data-testid="where">{`${pathname}${search} ${JSON.stringify(state)}`}</p>
  );
}

function renderReview(state: unknown = null) {
  return render(
    <ToastProvider>
      <MemoryRouter
        initialEntries={[{ pathname: "/practice/review/a1", state }]}
      >
        <Routes>
          <Route
            path="/practice/review/:attemptId"
            element={
              <>
                <ReviewPage />
                <Probe />
              </>
            }
          />
          <Route path="/practice/run" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

const ticks = () =>
  screen
    .getByRole("img", { name: /^Your answers in order/ })
    .querySelectorAll("span");

beforeEach(() => {
  vi.mocked(bankSummary).mockResolvedValue([]);
  vi.mocked(reviewRun).mockResolvedValue(REVIEW);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("a run review", () => {
  it("shows the server's score with a breakdown by area, weakest first, and each explanation", async () => {
    renderReview();
    expect(
      await screen.findByRole("heading", { level: 1, name: /1 of 3 right/ }),
    ).toBeTruthy();
    expect(
      screen.getByRole("img", {
        name: "Your answers in order: 1 correct, 1 wrong, 1 left blank.",
      }),
    ).toBeTruthy();
    const areas = within(
      screen.getByRole("list", {
        name: "Accuracy by instructional area, weakest first",
      }),
    ).getAllByRole("listitem");
    expect(areas.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Investing (0 of 2)"),
      expect.stringContaining("Saving (1 of 1)"),
    ]);
    expect(
      screen.getByText("A budget plans spending before it happens."),
    ).toBeTruthy();
    expect(screen.getByText("+12 from 1000")).toBeTruthy();
  });

  it("plays the reveal only on arrival from a submit, then forgets it so a reload shows the result at rest", async () => {
    renderReview({ justSubmitted: true });
    await screen.findByRole("heading", { level: 1, name: /1 of 3 right/ });
    expect(
      [...ticks()].every((t) =>
        (t.getAttribute("style") ?? "").includes("tick-fill"),
      ),
    ).toBe(true);
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/practice/review/a1 null",
      ),
    );
  });

  it("shows a revisit at rest", async () => {
    renderReview();
    await screen.findByRole("heading", { level: 1, name: /1 of 3 right/ });
    expect(
      [...ticks()].some((t) =>
        (t.getAttribute("style") ?? "").includes("tick-fill"),
      ),
    ).toBe(false);
  });

  it("retries only the missed questions still in the bank, with one run however often the button is pressed", async () => {
    vi.mocked(startRun)
      .mockRejectedValueOnce(new Error("Could not start the run."))
      .mockResolvedValueOnce({ attempt_id: "a2" } as RunState);
    renderReview();
    const retry = await screen.findByRole("button", {
      name: "Retry the 1 you missed",
    });
    expect(
      screen.getByText(/1 missed question was removed from the bank since/),
    ).toBeTruthy();

    fireEvent.click(retry);
    expect(await screen.findByRole("alert")).toHaveProperty(
      "textContent",
      "Could not start the run.",
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Retry the 1 you missed" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("where").textContent).toBe(
        "/practice/run?attempt=a2 null",
      ),
    );

    const [first, second] = vi.mocked(startRun).mock.calls.map((c) => c[0]);
    expect(first).toMatchObject({ kind: "redo", questionIds: ["q2"] });
    expect(second.clientId).toBe(first.clientId);
  });
});
