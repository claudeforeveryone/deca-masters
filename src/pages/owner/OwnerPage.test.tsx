import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isPlatformOwner } from "../../api/owner";
import { OwnerPage } from "./OwnerPage";

// The page's only input is the server's answer; the API module is the seam.
vi.mock("../../api/owner", () => ({ isPlatformOwner: vi.fn() }));
const check = vi.mocked(isPlatformOwner);

const renderPage = () =>
  render(
    <MemoryRouter>
      <OwnerPage />
    </MemoryRouter>,
  );

afterEach(() => check.mockReset());

describe("owner console gate", () => {
  it("says not authorized when the database says no", async () => {
    check.mockResolvedValue(false);
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Not authorized" });
    expect(screen.queryByText(/Owner console/)).toBeNull();
  });

  it("opens the console only when the database says yes", async () => {
    check.mockResolvedValue(true);
    renderPage();
    await screen.findByRole("heading", { level: 1, name: "Owner console" });
  });

  it("shows the error instead of guessing when the check fails", async () => {
    check.mockRejectedValue(new Error("Could not check owner access."));
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("Could not check owner access.");
    expect(screen.queryByText(/Owner console/)).toBeNull();
  });
});
