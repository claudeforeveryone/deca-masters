import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../../lib/supabase",
  async () => (await import("../../test/supabaseMock")).supabaseModule,
);
vi.mock("../../api/practice", async (original) => ({
  ...(await original<typeof import("../../api/practice")>()),
  resumeRun: vi.fn(),
  saveProgress: vi.fn(),
  submitRun: vi.fn(),
  checkAnswer: vi.fn(),
  discardRun: vi.fn(),
}));
vi.mock("../../api/questions", async (original) => ({
  ...(await original<typeof import("../../api/questions")>()),
  getQuestions: vi.fn(),
  bankSummary: vi.fn(),
}));
import { ApiError, NETWORK_CODE } from "../../api/core";
import {
  resumeRun,
  saveProgress,
  submitRun,
  type RunResult,
  type RunState,
  type SaveResult,
} from "../../api/practice";
import {
  bankSummary,
  getQuestions,
  type QuestionPublic,
} from "../../api/questions";
import { ToastProvider } from "../../components/ui/Toast";
import { readUnsent } from "../../lib/runStash";
import { RunPage } from "./RunPage";

const question = (id: string, stem: string): QuestionPublic => ({
  id,
  exam: "finance",
  area: "Investing",
  pi: null,
  difficulty: 1,
  stem,
  choices: ["Alpha", "Bravo", "Charlie", "Delta"],
  status: "sourced",
  source: {
    title: "Open textbook",
    url: "https://example.org/book",
    licence: "CC BY 4.0",
    attribution: "Example authors",
    adapted: false,
  },
});
const Q1 = question("q1", "What does a budget plan?");
const Q2 = question("q2", "What is compound interest?");

function runState(over: Partial<RunState> = {}): RunState {
  return {
    attempt_id: "a1",
    client_id: "c1",
    kind: "practice",
    exam: "finance",
    area: null,
    label: null,
    status: "in_progress",
    feedback: false,
    question_ids: ["q1", "q2"],
    time_limit_sec: null,
    started_at: "2026-10-11T12:00:00Z",
    deadline_at: null,
    server_now: new Date().toISOString(),
    remaining_ms: null,
    expired: false,
    position: 0,
    elapsed_ms: 0,
    last_saved_at: null,
    answers: [],
    deadline_local_ms: null,
    ...over,
  };
}

const saved = (): SaveResult => ({
  attempt_id: "a1",
  saved: 1,
  last_saved_at: new Date().toISOString(),
  server_now: new Date().toISOString(),
  deadline_at: null,
  remaining_ms: null,
  deadline_local_ms: null,
});

const graded = (over: Partial<RunResult> = {}): RunResult => ({
  attempt_id: "a1",
  client_id: "c1",
  kind: "practice",
  exam: "finance",
  area: null,
  label: null,
  status: "submitted",
  correct: 1,
  total: 2,
  duration_ms: 1000,
  elo_before: 1000,
  elo_after: 1010,
  timed_out: false,
  started_at: "2026-10-11T12:00:00Z",
  submitted_at: "2026-10-11T12:05:00Z",
  time_limit_sec: null,
  current_streak: 1,
  answers: [],
  replayed: false,
  ...over,
});

function ReviewStub() {
  const { pathname, state } = useLocation();
  return <p>{`review ${pathname} ${JSON.stringify(state)}`}</p>;
}

function renderRun(attempt = "a1") {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={[`/practice/run?attempt=${attempt}`]}>
        <Routes>
          <Route path="/practice/run" element={<RunPage />} />
          <Route path="/practice/review/:id" element={<ReviewStub />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

const heading = (n: number, of: number) =>
  screen.findByRole("heading", { name: `Question ${n} of ${of}` });
const press = (key: string) => fireEvent.keyDown(document.body, { key });

beforeEach(() => {
  // one tab per test: a real channel would let tests hear each other
  vi.stubGlobal("BroadcastChannel", undefined);
  vi.mocked(bankSummary).mockResolvedValue([]);
  vi.mocked(getQuestions).mockResolvedValue([Q1, Q2]);
  vi.mocked(saveProgress).mockResolvedValue(saved());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("a practice run", () => {
  it("answers from the keyboard and autosaves the answer to the server", async () => {
    vi.mocked(resumeRun).mockResolvedValue(runState());
    renderRun();
    await heading(1, 2);

    press("b");
    expect(
      (screen.getByRole("radio", { name: "Bravo" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    await waitFor(() =>
      expect(saveProgress).toHaveBeenCalledWith(
        "a1",
        [expect.objectContaining({ question_id: "q1", chosen: 1 })],
        expect.anything(),
      ),
    );

    press("ArrowRight");
    await heading(2, 2);
  });

  it("resumes where the member left off, with their saved answer and flag", async () => {
    vi.mocked(resumeRun).mockResolvedValue(
      runState({
        position: 1,
        answers: [
          {
            question_id: "q2",
            chosen: 2,
            flagged: true,
            ms: 4000,
            locked: false,
          },
        ],
      }),
    );
    renderRun();
    await heading(2, 2);
    expect(
      (screen.getByRole("radio", { name: "Charlie" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(screen.getByRole("button", { name: "Flagged" })).toHaveProperty(
      "ariaPressed",
      "true",
    );
  });

  it("explains a question removed from the bank mid-run instead of showing a blank one", async () => {
    vi.mocked(getQuestions).mockResolvedValue([Q1]);
    vi.mocked(resumeRun).mockResolvedValue(
      runState({
        kind: "exam",
        time_limit_sec: 600,
        remaining_ms: 590_000,
        deadline_local_ms: Date.now() + 590_000,
        position: 1,
      }),
    );
    renderRun();
    await heading(2, 2);
    expect(
      screen.getByText("This question was removed from the bank."),
    ).toBeTruthy();
    expect(screen.getByText(/counts as unanswered/)).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("asks before submitting and grades a double click only once", async () => {
    let finish!: (r: RunResult) => void;
    vi.mocked(submitRun).mockReturnValue(
      new Promise<RunResult>((done) => {
        finish = done;
      }),
    );
    vi.mocked(resumeRun).mockResolvedValue(
      runState({
        position: 1,
        answers: [
          {
            question_id: "q1",
            chosen: 0,
            flagged: false,
            ms: 0,
            locked: false,
          },
        ],
      }),
    );
    renderRun();
    await heading(2, 2);

    press("Enter"); // the last question: Enter opens the confirmation, it never submits on its own
    const dialog = await screen.findByRole("dialog", {
      name: "Submit for grading?",
    });
    expect(submitRun).not.toHaveBeenCalled();
    const go = screen.getByRole("button", { name: "Submit for grading" });
    fireEvent.click(go);
    fireEvent.click(go);
    await waitFor(() => expect(submitRun).toHaveBeenCalledTimes(1));
    expect(vi.mocked(submitRun).mock.calls[0][0]).toMatchObject({
      clientId: "c1",
      answers: [expect.objectContaining({ question_id: "q1", chosen: 0 })],
    });
    expect(dialog).toBeTruthy();

    await act(async () => finish(graded()));
    expect(
      await screen.findByText(
        'review /practice/review/a1 {"justSubmitted":true,"timedOut":false}',
      ),
    ).toBeTruthy();
    expect(submitRun).toHaveBeenCalledTimes(1);
  });

  it("grades once when the clock runs out while the member's own submit is still on its way", async () => {
    let finish!: (r: RunResult) => void;
    vi.mocked(submitRun).mockReturnValue(
      new Promise<RunResult>((done) => {
        finish = done;
      }),
    );
    vi.mocked(resumeRun).mockResolvedValue(
      runState({
        kind: "exam",
        time_limit_sec: 60,
        position: 1,
        remaining_ms: 700,
        deadline_local_ms: Date.now() + 700,
      }),
    );
    renderRun();
    await heading(2, 2);
    press("Enter");
    fireEvent.click(
      await screen.findByRole("button", { name: "Submit for grading" }),
    );
    await waitFor(() => expect(submitRun).toHaveBeenCalledTimes(1));
    await act(() => new Promise((wait) => setTimeout(wait, 1000))); // the deadline passes mid-request
    expect(submitRun).toHaveBeenCalledTimes(1);
    await act(async () => finish(graded({ kind: "exam" })));
    expect(
      await screen.findByText(/^review \/practice\/review\/a1/),
    ).toBeTruthy();
    expect(submitRun).toHaveBeenCalledTimes(1);
  });

  it("submits by itself when the clock runs out", async () => {
    vi.mocked(submitRun).mockResolvedValue(
      graded({ kind: "exam", timed_out: true }),
    );
    vi.mocked(resumeRun).mockResolvedValue(
      runState({
        kind: "exam",
        time_limit_sec: 60,
        remaining_ms: 400,
        deadline_local_ms: Date.now() + 400,
      }),
    );
    renderRun();
    await heading(1, 2);
    expect(screen.getByRole("timer")).toBeTruthy();
    expect(
      await screen.findByText(
        'review /practice/review/a1 {"justSubmitted":true,"timedOut":true}',
      ),
    ).toBeTruthy();
    expect(submitRun).toHaveBeenCalledTimes(1);
  });

  it("keeps an answer made offline on the device through leaving, then sends it on the next visit", async () => {
    vi.mocked(resumeRun).mockResolvedValue(runState());
    vi.mocked(saveProgress).mockRejectedValue(
      new ApiError("Network error.", NETWORK_CODE),
    );
    const first = renderRun();
    await heading(1, 2);
    press("c");
    await waitFor(() =>
      expect(readUnsent("a1")?.answers).toEqual([
        expect.objectContaining({ question_id: "q1", chosen: 2 }),
      ]),
    );
    first.unmount(); // the back button, a closed tab or a refresh

    vi.mocked(saveProgress).mockReset().mockResolvedValue(saved());
    renderRun();
    await heading(1, 2);
    expect(
      (screen.getByRole("radio", { name: "Charlie" }) as HTMLInputElement)
        .checked,
    ).toBe(true);
    await waitFor(() =>
      expect(saveProgress).toHaveBeenCalledWith(
        "a1",
        [expect.objectContaining({ question_id: "q1", chosen: 2 })],
        expect.anything(),
      ),
    );
    await waitFor(() => expect(readUnsent("a1")).toBeNull());
  });
});
