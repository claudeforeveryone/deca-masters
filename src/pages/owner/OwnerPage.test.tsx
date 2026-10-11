import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsOwner } from "../../lib/useIsOwner";
import { OwnerPage } from "./OwnerPage";

// The page's only input is the server's answer to "is this user an owner?"; the hook that asks is the seam.
vi.mock("../../lib/useIsOwner", () => ({
  useIsOwner: vi.fn(),
  resetOwnerChecks: vi.fn(),
}));
// The console's first section asks for the overview; keep it pending so nothing reaches Supabase.
vi.mock("../../api/owner", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/owner")>()),
  ownerOverview: vi.fn(() => new Promise(() => {})),
}));
const state = vi.mocked(useIsOwner);

const renderPage = () =>
  render(
    <MemoryRouter>
      <OwnerPage />
    </MemoryRouter>,
  );

afterEach(() => state.mockReset());

describe("owner console gate", () => {
  it("says not authorized when the database says no", async () => {
    state.mockReturnValue("denied");
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Not authorized" });
    expect(screen.queryByText(/Owner console/)).toBeNull();
    expect(screen.getByRole("link", { name: "Back to home" })).toBeTruthy();
  });

  it("opens the console only when the database says yes", async () => {
    state.mockReturnValue("owner");
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Owner console" });
    expect(screen.getByRole("tab", { name: "Members" })).toBeTruthy();
  });

  it("waits instead of guessing while the check runs", () => {
    state.mockReturnValue("checking");
    renderPage();
    expect(screen.queryByRole("heading", { name: "Owner console" })).toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Not authorized" }),
    ).toBeNull();
  });

  it("shows the error instead of guessing when the check fails", async () => {
    state.mockReturnValue("error");
    renderPage();
    await screen.findByRole("heading", {
      level: 1,
      name: "Could not check owner access",
    });
    expect(screen.queryByText(/Owner console/)).toBeNull();
  });
});
