import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { moveModule, type ModuleId } from "../../../lib/board";
import { Board, type ModuleView } from "./Board";

const VIEWS: ModuleView[] = [
  {
    id: "continue",
    title: "Continue",
    status: "ready",
    reading: "Nothing open",
  },
  {
    id: "today",
    title: "Today",
    status: "ready",
    reading: "No goal yet",
    detail: <p>Goal form</p>,
  },
  { id: "streak", title: "Streak", status: "ready", reading: "0 days" },
];

function Harness({
  arranging,
  onMove = () => {},
}: {
  arranging: boolean;
  onMove?: (id: ModuleId, to: number) => void;
}) {
  const [order, setOrder] = useState<ModuleId[]>(VIEWS.map((v) => v.id));
  const [open, setOpen] = useState<ModuleId[]>([]);
  const views = order.map((id) => VIEWS.find((v) => v.id === id)!);
  return (
    <Board
      views={views}
      open={open}
      onToggle={(id) =>
        setOpen((o) =>
          o.includes(id) ? o.filter((x) => x !== id) : [...o, id],
        )
      }
      arranging={arranging}
      onMove={(id, to) => {
        onMove(id, to);
        setOrder((o) => moveModule(o, id, to));
      }}
    />
  );
}

function rowTitles() {
  return screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
}

describe("arranging the board", () => {
  it("moves a module with the buttons, announces it and keeps focus on the button", () => {
    const onMove = vi.fn();
    render(<Harness arranging onMove={onMove} />);
    expect(
      (
        screen.getByRole("button", {
          name: "Move Continue up",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole("button", {
          name: "Move Streak down",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Move Continue down" }));
    expect(onMove).toHaveBeenCalledWith("continue", 1);
    expect(rowTitles()).toEqual(["Today", "Continue", "Streak"]);
    expect(screen.getByText("Continue moved to position 2 of 3.")).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Move Continue down" }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Move Streak up" }));
    expect(rowTitles()).toEqual(["Today", "Streak", "Continue"]);
    expect(screen.getByText("Streak moved to position 2 of 3.")).toBeTruthy();
  });

  it("gives every row a drag handle while arranging, and none otherwise", () => {
    const { rerender } = render(<Harness arranging />);
    expect(screen.getAllByRole("button", { name: /^Drag / })).toHaveLength(3);
    rerender(<Harness arranging={false} />);
    expect(screen.queryAllByRole("button", { name: /^Drag / })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: /^Move / })).toBeNull();
  });
});

describe("opening a module", () => {
  it("shows details in place and reports the state on the toggle", () => {
    render(<Harness arranging={false} />);
    const toggle = screen.getByRole("button", { name: "Show Today details" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Goal form")).toBeNull();
    fireEvent.click(toggle);
    const hide = screen.getByRole("button", { name: "Hide Today details" });
    expect(hide.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Goal form")).toBeTruthy();
    // Modules without details have no toggle at all, rather than a dead button.
    expect(
      screen.queryByRole("button", { name: /Continue details/ }),
    ).toBeNull();
  });
});
