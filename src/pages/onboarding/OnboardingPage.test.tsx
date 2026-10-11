import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EventItem } from "../../lib/content";
import { resetProfileStore } from "../../lib/profile";
import { OnboardingPage } from "./OnboardingPage";

const api = vi.hoisted(() => ({
  getMyProfile: vi.fn(async () => null),
  saveProfile: vi.fn(),
  isUsernameAvailable: vi.fn(async () => true),
}));

vi.mock("../../lib/auth", () => ({
  useAuth: () => ({
    user: { id: "u-1", email: "sam@example.org" },
    loading: false,
  }),
}));
vi.mock("../../api/profile", async (orig) => ({
  ...(await orig<typeof import("../../api/profile")>()),
  getMyProfile: api.getMyProfile,
  saveProfile: api.saveProfile,
  isUsernameAvailable: api.isUsernameAvailable,
}));

function event(code: string, name: string): EventItem {
  return {
    code,
    name,
    category: "Individual Series",
    cluster: "marketing",
    exam: "marketing",
    components: ["exam", "roleplay"],
    teamSize: "1",
    summary: "",
    officialUrl: "https://www.deca.org",
    verifiedAt: "2026-09-01",
    notes: null,
  };
}
vi.mock("../../api/events", () => ({
  listEvents: async () => [
    event("PMK", "Principles of Marketing"),
    event("AAM", "Apparel and Accessories Marketing Series"),
  ],
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/onboarding?next=%2Fprogress"]}>
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/progress" element={<p>Progress page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetProfileStore();
  vi.clearAllMocks();
});

describe("onboarding", () => {
  it("asks for a name, a username and an event before saving anything", async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole("button", { name: "Save and open my board" }),
    );
    expect(
      await screen.findByText("Add the name people should see."),
    ).toBeTruthy();
    expect(screen.getByText("Pick a username.")).toBeTruthy();
    expect(screen.getByText("Pick at least one event.")).toBeTruthy();
    expect(api.saveProfile).not.toHaveBeenCalled();
  });

  it("saves a private profile with the main event first, then goes where the member was heading", async () => {
    api.saveProfile.mockImplementation(async (patch: object) => ({
      id: "u-1",
      ...patch,
    }));
    renderPage();
    fireEvent.change(await screen.findByLabelText("Display name"), {
      target: { value: " Sam " },
    });
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "Sam_Q" },
    });
    await screen.findByText("Available.");
    fireEvent.click(await screen.findByLabelText(/Apparel and Accessories/));
    fireEvent.click(screen.getByLabelText(/Principles of Marketing/));
    fireEvent.click(
      screen.getByRole("button", { name: "Save and open my board" }),
    );
    await screen.findByText("Progress page");
    expect(api.saveProfile).toHaveBeenCalledWith({
      display_name: "Sam",
      username: "sam_q",
      events: ["AAM", "PMK"],
      school: null,
      grade: null,
      is_public: false,
    });
    await waitFor(() =>
      expect(api.isUsernameAvailable).toHaveBeenCalledWith("sam_q"),
    );
  });
});
