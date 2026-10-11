import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetProfileStore } from "../../lib/profile";
import { RequireProfile } from "./RequireProfile";

const api = vi.hoisted(() => ({ getMyProfile: vi.fn() }));
vi.mock("../../api/profile", () => api);
vi.mock("../../lib/auth", () => ({
  useAuth: () => ({ user: { id: "u-1" }, loading: false }),
}));

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{loc.pathname + loc.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="onboarding" element={<h1>Onboarding</h1>} />
        <Route element={<RequireProfile />}>
          <Route path="progress" element={<h1>Progress</h1>} />
        </Route>
      </Routes>
      <Where />
    </MemoryRouter>,
  );
}

beforeEach(() => resetProfileStore());
afterEach(() => api.getMyProfile.mockReset());

describe("RequireProfile", () => {
  it("sends a member with no DECA profile to onboarding and remembers the page", async () => {
    api.getMyProfile.mockResolvedValue(null);
    renderAt("/progress");
    await screen.findByRole("heading", { name: "Onboarding" });
    expect(screen.getByTestId("where").textContent).toBe(
      `/onboarding?next=${encodeURIComponent("/progress")}`,
    );
  });

  it("lets a member with a profile through", async () => {
    api.getMyProfile.mockResolvedValue({
      id: "u-1",
      username: "sam",
      events: [],
    });
    renderAt("/progress");
    await screen.findByRole("heading", { name: "Progress" });
  });

  it("offers a retry when the profile cannot load", async () => {
    api.getMyProfile.mockRejectedValueOnce(
      new Error("Could not load your profile."),
    );
    renderAt("/progress");
    expect((await screen.findByRole("alert")).textContent).toContain(
      "Your profile did not load",
    );
    api.getMyProfile.mockResolvedValue({
      id: "u-1",
      username: "sam",
      events: [],
    });
    screen.getByRole("button", { name: "Try again" }).click();
    await screen.findByRole("heading", { name: "Progress" });
  });
});
