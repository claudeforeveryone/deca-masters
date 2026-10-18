import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../../lib/supabase",
  async () => (await import("../../test/supabaseMock")).supabaseModule,
);
vi.mock("../../api/practice", async (original) => ({
  ...(await original<typeof import("../../api/practice")>()),
  startRun: vi.fn(),
}));
vi.mock("../../api/questions", async (original) => ({
  ...(await original<typeof import("../../api/questions")>()),
  bankSummary: vi.fn(),
  pickQuestions: vi.fn(),
  getQuestions: vi.fn(),
}));
vi.mock("../../api/profile", async (original) => ({
  ...(await original<typeof import("../../api/profile")>()),
  getMyProfile: vi.fn(),
}));
vi.mock("../../lib/content", async (original) => ({
  ...(await original<typeof import("../../lib/content")>()),
  loadPastExams: vi.fn(),
}));
import { startRun, type RunState } from "../../api/practice";
import { getMyProfile, type Profile } from "../../api/profile";
import {
  bankSummary,
  getQuestions,
  pickQuestions,
  type BankExam,
  type PickedQuestion,
  type QuestionPublic,
} from "../../api/questions";
import { loadPastExams } from "../../lib/content";
import { PREF_PREFIX } from "../../lib/prefs";
import { QuizPage } from "./QuizPage";

const BANK: BankExam = {
  exam: "finance",
  title: "Finance Cluster Exam",
  cluster: "finance",
  status: "sourced",
  placeholder_note: null,
  questions: 300,
  difficulty: { easy: 0, medium: 0, hard: 0, unrated: 300 },
  areas: [
    { area: "Financial Analysis", questions: 200 },
    { area: "Economics", questions: 100 },
  ],
  updated_at: "2026-10-18T00:00:00Z",
};

const pick = (ids: string[]) => ({
  mode: "practice" as const,
  exam: "finance" as const,
  area: null,
  requested: ids.length,
  available: 300,
  empty_reason: null,
  questions: ids.map((id) => ({ id }) as PickedQuestion),
  day: null,
});

function Probe() {
  const { pathname, search } = useLocation();
  return <p>{`at ${pathname}${search}`}</p>;
}

function renderQuiz() {
  return render(
    <MemoryRouter initialEntries={["/quiz"]}>
      <Routes>
        <Route path="/quiz" element={<QuizPage />} />
        <Route path="/practice/run" element={<Probe />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  vi.mocked(getMyProfile).mockResolvedValue({ events: [] } as unknown as Profile);
  vi.mocked(bankSummary).mockResolvedValue([BANK]);
  vi.mocked(loadPastExams).mockResolvedValue({
    exams: { finance: [{ code: "1028-FIN", questions: 3, ids: ["f1", "f2", "f3"] }] },
  });
  vi.mocked(startRun).mockResolvedValue({ attempt_id: "a1" } as RunState);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("quiz settings", () => {
  it("starts a past exam in booklet order on DECA's clock as a mock exam", async () => {
    vi.mocked(getQuestions).mockResolvedValue(
      ["f1", "f2", "f3"].map((id) => ({ id }) as QuestionPublic),
    );
    renderQuiz();
    fireEvent.click(await screen.findByRole("radio", { name: /^Past exam/ }));
    fireEvent.change(screen.getByLabelText("Past exam"), { target: { value: "1028-FIN" } });
    fireEvent.click(screen.getByRole("radio", { name: "DECA pace" }));
    fireEvent.click(screen.getByRole("radio", { name: "At the end" }));
    fireEvent.click(screen.getByRole("button", { name: /Start quiz/ }));
    expect(await screen.findByText("at /practice/run?attempt=a1")).toBeTruthy();
    expect(vi.mocked(startRun).mock.calls[0][0]).toMatchObject({
      kind: "exam",
      exam: "finance",
      questionIds: ["f1", "f2", "f3"],
      feedback: false,
      timeLimitSec: 3 * 42,
      label: "Past exam 1028-FIN",
    });
    // remembered for next time
    expect(window.localStorage.getItem(`${PREF_PREFIX}quiz-settings`)).toContain("1028-FIN");
  });

  it("spreads a topics quiz over every picked area with a custom timer", async () => {
    vi.mocked(pickQuestions).mockImplementation(async (o) =>
      pick(Array.from({ length: o.count ?? 0 }, (_, i) => `${o.area}-${i}`)),
    );
    renderQuiz();
    fireEvent.click(await screen.findByRole("radio", { name: /^Topics/ }));
    fireEvent.click(screen.getByRole("button", { name: "All" }));
    fireEvent.click(screen.getAllByRole("radio", { name: "Custom" })[0]);
    fireEvent.change(screen.getByLabelText("Questions"), { target: { value: "30" } });
    fireEvent.click(screen.getAllByRole("radio", { name: "Custom" })[1]);
    fireEvent.change(screen.getByLabelText("Minutes"), { target: { value: "12" } });
    fireEvent.click(screen.getByRole("button", { name: /Start quiz/ }));
    await waitFor(() => expect(startRun).toHaveBeenCalled());
    expect(pickQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "area", area: "Financial Analysis", count: 20 }),
    );
    expect(pickQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "area", area: "Economics", count: 10 }),
    );
    const plan = vi.mocked(startRun).mock.calls[0][0];
    expect(plan).toMatchObject({ kind: "practice", feedback: true, timeLimitSec: 720 });
    expect(plan.questionIds).toHaveLength(30);
  });

  it("says why when there is nothing to retake", async () => {
    vi.mocked(pickQuestions).mockResolvedValue({ ...pick([]), empty_reason: "no_mistakes" });
    renderQuiz();
    fireEvent.click(await screen.findByRole("radio", { name: /^Missed/ }));
    fireEvent.click(screen.getByRole("button", { name: /Start quiz/ }));
    expect(await screen.findByText(/No mistakes to redo/)).toBeTruthy();
    expect(startRun).not.toHaveBeenCalled();
  });
});
