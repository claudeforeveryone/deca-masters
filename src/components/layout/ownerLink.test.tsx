import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAuth } from "../../lib/auth";
import { useIsOwner } from "../../lib/useIsOwner";
import { AppShell } from "./AppShell";

// Seams: who is signed in, and the server's answer to "is this account an owner?".
vi.mock("../../lib/auth", () => ({
  useAuth: vi.fn(),
  mayHaveStoredSession: () => true,
}));
vi.mock("../../lib/useIsOwner", () => ({ useIsOwner: vi.fn() }));
const auth = vi.mocked(useAuth);
const owner = vi.mocked(useIsOwner);

function renderShell() {
  auth.mockReturnValue({
    loading: false,
    user: { id: "u-1", email: "student@example.com" },
    signOut: vi.fn(),
  } as unknown as ReturnType<typeof useAuth>);
  render(
    <MemoryRouter>
      <AppShell>
        <p>Page</p>
      </AppShell>
    </MemoryRouter>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
  return screen.getByRole("menu");
}

afterEach(() => {
  auth.mockReset();
  owner.mockReset();
});

describe("account menu", () => {
  it("links owners to the owner console", () => {
    owner.mockReturnValue("owner");
    const menu = renderShell();
    expect(
      within(menu)
        .getByRole("menuitem", { name: "Owner console" })
        .getAttribute("href"),
    ).toBe("/owner");
  });

  it.each(["denied", "checking", "error"] as const)(
    "shows no owner link while the answer is %s",
    (state) => {
      owner.mockReturnValue(state);
      const menu = renderShell();
      expect(
        within(menu).queryByRole("menuitem", { name: "Owner console" }),
      ).toBeNull();
      expect(
        within(menu).getByRole("menuitem", { name: "Send feedback" }),
      ).toBeTruthy();
    },
  );
});
