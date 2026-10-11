import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../components/ui/Toast";
import { fixtureSource } from "./fixtures";
import { OwnerConsole } from "./OwnerConsole";
import type { OwnerSource } from "./shared";

// The console is tested through its data source seam: fixtures in, what an owner sees and what gets written out.
function renderConsole(source: OwnerSource, url = "/owner") {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <ToastProvider>
        <OwnerConsole source={source} />
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe("owner console", () => {
  it("shows the overview with withheld counts as Hidden, never as a number", async () => {
    renderConsole(fixtureSource());
    await screen.findByText("214");
    // overviewFixture.new_accounts.day is suppressed (1 to 4 people).
    expect(screen.getAllByText("Hidden").length).toBeGreaterThan(0);
    expect(screen.queryByText(/under 5/i)).toBeNull();
  });

  it("saves a triage change through the source", async () => {
    const source = fixtureSource();
    const update = vi.spyOn(source, "feedbackUpdate");
    renderConsole(source, "/owner?tab=feedback");
    const list = await screen.findByRole("list", { name: "Feedback" });
    fireEvent.click(within(list).getByText(/The timer kept running/));
    const detail = await screen.findByRole("article", {
      name: "Feedback report",
    });
    fireEvent.change(within(detail).getByLabelText("Status"), {
      target: { value: "in_progress" },
    });
    fireEvent.click(
      within(detail).getByRole("button", { name: "Save changes" }),
    );
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update.mock.calls[0][0]).toBe("f2");
    expect(update.mock.calls[0][1]).toMatchObject({ status: "in_progress" });
  });

  it("refuses a member action until a reason is written", async () => {
    const source = fixtureSource();
    const hide = vi.spyOn(source, "setLeaderboardHidden");
    renderConsole(source, "/owner?tab=users");
    fireEvent.change(screen.getByLabelText("Find a member"), {
      target: { value: "fixture_member_a" },
    });
    const card = await screen.findByRole("list", { name: "Members" });
    fireEvent.click(
      within(card).getByRole("button", { name: "Hide from leaderboard" }),
    );
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Hide from leaderboard" }),
    );
    await within(dialog).findByText(
      "Write a reason of at least 10 characters.",
    );
    expect(hide).not.toHaveBeenCalled();
    fireEvent.change(within(dialog).getByLabelText("Reason"), {
      target: { value: "Asked to be taken off the board." },
    });
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Hide from leaderboard" }),
    );
    await waitFor(() =>
      expect(hide).toHaveBeenCalledWith(
        "00000000-0000-4000-8000-00000000f001",
        true,
        "Asked to be taken off the board.",
      ),
    );
  });

  it("is honest when there is nothing to triage", async () => {
    renderConsole(fixtureSource({ empty: true }), "/owner?tab=feedback");
    await screen.findByRole("heading", { name: "Nothing waiting" });
  });
});
