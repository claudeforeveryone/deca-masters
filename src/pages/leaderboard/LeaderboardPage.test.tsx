import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Leaderboard, LeaderboardRow } from "../../api/leaderboard";
import { resetProfileStore, setMyProfile } from "../../lib/profile";
import { LeaderboardPage, MIN_BOARD } from "./LeaderboardPage";

const api = vi.hoisted(() => ({
  leaderboard: vi.fn(),
  saveProfile: vi.fn(),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "sam@example.org" },
    loading: false,
  }),
}));
vi.mock("../../api/leaderboard", () => ({ leaderboard: api.leaderboard }));
vi.mock("../../api/questions", () => ({ bankSummary: async () => [] }));
vi.mock("../../api/profile", async (orig) => ({
  ...(await orig<typeof import("../../api/profile")>()),
  getMyProfile: async () => profile,
  saveProfile: api.saveProfile,
}));

const profile = {
  id: "u-1",
  username: "sam",
  display_name: "Sam",
  school: null,
  grade: null,
  events: ["PMK"],
  is_public: false,
  leaderboard_hidden: false,
  elo: 1000,
  peak_elo: 1000,
  questions_answered: 12,
  questions_correct: 9,
  time_spent_ms: 0,
  current_streak: 1,
  best_streak: 1,
  answer_streak: 0,
  best_answer_streak: 3,
  last_active_date: "2026-10-11",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-11T00:00:00Z",
};

function row(rank: number, me = false): LeaderboardRow {
  return {
    rank,
    username: `player${rank}`,
    display_name: `Player ${rank}`,
    main_event: "PMK",
    elo: 1200 - rank,
    answered: 40,
    accuracy: 0.75,
    current_streak: 2,
    is_me: me,
  };
}

function board(total: number, isPublic = false): Leaderboard {
  return {
    exam: null,
    total,
    rows: Array.from({ length: total }, (_, i) => row(i + 1)),
    me: {
      has_profile: true,
      is_public: isPublic,
      hidden_by_owner: false,
      rank: null,
    },
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LeaderboardPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetProfileStore();
  setMyProfile(profile as never);
  vi.clearAllMocks();
});

describe("leaderboard", () => {
  it("stays closed, without any placeholder rows, below the minimum number of listed players", async () => {
    api.leaderboard.mockResolvedValue(board(MIN_BOARD - 1));
    renderPage();
    await screen.findByText("Not enough players to rank yet");
    expect(screen.getByText(/4 members have joined the board/)).toBeTruthy();
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.queryByText("Player 1")).toBeNull();
  });

  it("says nobody is listed when the board is empty", async () => {
    api.leaderboard.mockResolvedValue(board(0));
    renderPage();
    await screen.findByText("Nobody is listed yet");
  });

  it("ranks the listed players once there are enough", async () => {
    api.leaderboard.mockResolvedValue(board(MIN_BOARD));
    renderPage();
    const table = await screen.findByRole("table");
    expect(table.querySelectorAll("tbody tr")).toHaveLength(MIN_BOARD);
  });

  it("lets a private member choose to be listed", async () => {
    api.leaderboard.mockResolvedValue(board(0));
    api.saveProfile.mockResolvedValue({ ...profile, is_public: true });
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "List me on the board" }),
    );
    await waitFor(() =>
      expect(api.saveProfile).toHaveBeenCalledWith({ is_public: true }),
    );
    // The board is asked again so the standing reflects the change.
    await waitFor(() => expect(api.leaderboard).toHaveBeenCalledTimes(2));
  });
});
