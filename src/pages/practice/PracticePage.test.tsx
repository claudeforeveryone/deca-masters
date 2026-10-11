import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock(
  "../../lib/supabase",
  async () => (await import("../../test/supabaseMock")).supabaseModule,
);
vi.mock("../../api/practice", async (original) => ({
  ...(await original<typeof import("../../api/practice")>()),
  openRuns: vi.fn(),
  startRun: vi.fn(),
}));
vi.mock("../../api/questions", async (original) => ({
  ...(await original<typeof import("../../api/questions")>()),
  bankSummary: vi.fn(),
  pickQuestions: vi.fn(),
}));
vi.mock("../../api/profile", async (original) => ({
  ...(await original<typeof import("../../api/profile")>()),
  getMyProfile: vi.fn(),
}));
vi.mock("../../api/events", async (original) => ({
  ...(await original<typeof import("../../api/events")>()),
  listEvents: vi.fn(),
}));
vi.mock("../../api/progress", async (original) => ({
  ...(await original<typeof import("../../api/progress")>()),
  runHistory: vi.fn(),
}));
import { ApiError, NETWORK_CODE } from "../../api/core";
import { listEvents } from "../../api/events";
import { openRuns, startRun, type RunState } from "../../api/practice";
import type { Profile } from "../../api/profile";
import { getMyProfile } from "../../api/profile";
import { runHistory } from "../../api/progress";
import {
  bankSummary,
  pickQuestions,
  type BankExam,
  type PickedQuestion,
} from "../../api/questions";
import { ToastProvider } from "../../components/ui/Toast";
import { PracticePage } from "./PracticePage";

const BANK: BankExam = {
  exam: "finance",
  title: "Finance Cluster Exam",
  cluster: "finance",
  status: "sourced",
  placeholder_note: null,
  questions: 3,
  difficulty: { easy: 3, medium: 0, hard: 0, unrated: 0 },
  areas: [{ area: "Investing", questions: 3 }],
  updated_at: "2026-10-10T12:00:00Z",
};

const picked = (id: string) =>
  ({ id, exam: "finance", area: "Investing", seen: false }) as PickedQuestion;

function Probe() {
  const { pathname, search } = useLocation();
  return <p>{`at ${pathname}${search}`}</p>;
}

function renderPractice() {
  return render(
    <ToastProvider>
      <MemoryRouter initialEntries={["/practice"]}>
        <Routes>
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/practice/run" element={<Probe />} />
        </Routes>
      </MemoryRouter>
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.mocked(getMyProfile).mockResolvedValue({
    events: [],
  } as unknown as Profile);
  vi.mocked(bankSummary).mockResolvedValue([BANK]);
  vi.mocked(listEvents).mockResolvedValue([]);
  vi.mocked(openRuns).mockResolvedValue([]);
  vi.mocked(runHistory).mockResolvedValue({ rows: [], nextBefore: null });
  vi.mocked(pickQuestions).mockResolvedValue({
    mode: "exam",
    exam: "finance",
    area: null,
    requested: 3,
    available: 3,
    empty_reason: null,
    questions: [picked("q1"), picked("q2"), picked("q3")],
    day: null,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("starting a run", () => {
  it("starts a full exam at the real pace, and a retry after a dropped reply lands on the same run", async () => {
    vi.mocked(startRun)
      .mockRejectedValueOnce(new ApiError("Network error.", NETWORK_CODE))
      .mockResolvedValueOnce({ attempt_id: "a9" } as RunState);
    renderPractice();
    fireEvent.click(await screen.findByRole("radio", { name: /^Full exam/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await screen.findByText(/Network error/);

    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    expect(await screen.findByText("at /practice/run?attempt=a9")).toBeTruthy();

    const [first, second] = vi.mocked(startRun).mock.calls.map((c) => c[0]);
    expect(first).toMatchObject({
      kind: "exam",
      exam: "finance",
      questionIds: ["q1", "q2", "q3"],
      feedback: false,
      timeLimitSec: 3 * 42,
    });
    expect(second.clientId).toBe(first.clientId);
    expect(pickQuestions).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "exam", exam: "finance", count: 3 }),
    );
  });

  it("gives a new run its own id once the member changes what they asked for", async () => {
    vi.mocked(startRun)
      .mockRejectedValueOnce(new ApiError("Network error.", NETWORK_CODE))
      .mockResolvedValueOnce({ attempt_id: "a10" } as RunState);
    renderPractice();
    fireEvent.click(await screen.findByRole("radio", { name: /^Full exam/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await screen.findByText(/Network error/);

    fireEvent.click(screen.getByRole("radio", { name: /^Untimed practice/ }));
    fireEvent.click(screen.getByRole("button", { name: "Start" }));
    await waitFor(() => expect(startRun).toHaveBeenCalledTimes(2));
    const [first, second] = vi.mocked(startRun).mock.calls.map((c) => c[0]);
    expect(second.clientId).not.toBe(first.clientId);
  });
});
