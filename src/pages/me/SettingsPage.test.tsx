import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetProfileStore } from "../../lib/profile";
import { SettingsPage } from "./SettingsPage";

const calls = vi.hoisted(() => [] as string[]);
const api = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  saveProfile: vi.fn(),
  deleteMyDecaData: vi.fn(),
  isUsernameAvailable: vi.fn(async () => true),
  changePassword: vi.fn(),
  requestAccountDeletion: vi.fn(),
  signOutEverywhere: vi.fn(),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "sam@example.org" },
    loading: false,
  }),
}));
vi.mock("../../api/events", () => ({ listEvents: async () => [] }));
vi.mock("../../api/profile", async (orig) => ({
  ...(await orig<typeof import("../../api/profile")>()),
  getMyProfile: api.getMyProfile,
  saveProfile: api.saveProfile,
  deleteMyDecaData: api.deleteMyDecaData,
  isUsernameAvailable: api.isUsernameAvailable,
}));
vi.mock("../../api/account", () => ({
  MIN_PASSWORD: 8,
  changePassword: api.changePassword,
  requestAccountDeletion: api.requestAccountDeletion,
  signOutEverywhere: api.signOutEverywhere,
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
  elo: 0,
  peak_elo: 0,
  questions_answered: 0,
  questions_correct: 0,
  time_spent_ms: 0,
  current_streak: 0,
  best_streak: 0,
  answer_streak: 0,
  best_answer_streak: 0,
  last_active_date: null,
  created_at: "2026-10-11T00:00:00Z",
  updated_at: "2026-10-11T00:00:00Z",
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/me/settings"]}>
      <SettingsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetProfileStore();
  calls.length = 0;
  api.getMyProfile.mockResolvedValue(profile);
  api.deleteMyDecaData.mockImplementation(async () => {
    calls.push("delete");
    return { deleted: true };
  });
  api.requestAccountDeletion.mockImplementation(async () => {
    calls.push("request");
  });
});
afterEach(() => {
  delete document.documentElement.dataset.theme;
  vi.clearAllMocks();
});

describe("appearance setting", () => {
  it("switches the theme at once and keeps it for the next visit on this device", () => {
    const first = renderPage();
    expect(
      (screen.getByLabelText("Match my device") as HTMLInputElement).checked,
    ).toBe(true);
    fireEvent.click(screen.getByLabelText("Dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");
    first.unmount();
    renderPage();
    expect((screen.getByLabelText("Dark") as HTMLInputElement).checked).toBe(
      true,
    );
  });
});

describe("deleting an account", () => {
  it("deletes the DECA data first, then files the sign-in deletion request so the request survives", async () => {
    renderPage();
    const box = await screen.findByLabelText(
      /Type "delete my DECA data" to confirm/,
    );
    const button = screen.getByRole("button", {
      name: "Delete my DECA data",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.change(box, { target: { value: "Delete my DECA data " } });
    fireEvent.click(
      screen.getByLabelText(
        "Also ask the site team to delete my sign-in account",
      ),
    );
    fireEvent.click(button);
    await screen.findByText(
      /request to delete the sign-in account is with the site team/,
    );
    expect(calls).toEqual(["delete", "request"]);
  });

  it("without a DECA profile, still lets the member ask for the sign-in to be deleted", async () => {
    api.getMyProfile.mockResolvedValue(null);
    renderPage();
    await screen.findByText(/You have no DECA profile on this sign-in/);
    fireEvent.click(
      screen.getByRole("button", { name: "Ask to delete my sign-in account" }),
    );
    await screen.findByText(/Request sent/);
    expect(calls).toEqual(["request"]);
  });
});

describe("password", () => {
  it("checks the two new passwords match before asking the server", async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText("Current password"), {
      target: { value: "old-secret" },
    });
    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "new-secret-1" },
    });
    fireEvent.change(screen.getByLabelText("New password again"), {
      target: { value: "new-secret-2" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "do not match",
    );
    expect(api.changePassword).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("New password again"), {
      target: { value: "new-secret-1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));
    await waitFor(() =>
      expect(api.changePassword).toHaveBeenCalledWith(
        "old-secret",
        "new-secret-1",
      ),
    );
  });
});

describe("sign out everywhere", () => {
  it("asks for confirmation first", async () => {
    renderPage();
    fireEvent.click(
      screen.getByRole("button", { name: "Sign out everywhere" }),
    );
    expect(api.signOutEverywhere).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Yes, sign out on all devices" }),
    );
    await waitFor(() => expect(api.signOutEverywhere).toHaveBeenCalledTimes(1));
  });
});
