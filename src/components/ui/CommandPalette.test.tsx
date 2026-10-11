import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  CommandPalette,
  usePaletteShortcut,
  type PaletteCommand,
} from "./CommandPalette";

function Harness({ commands }: { commands: PaletteCommand[] }) {
  const [open, setOpen] = useState(false);
  usePaletteShortcut(setOpen);
  return (
    <>
      <button type="button">elsewhere</button>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        commands={commands}
      />
    </>
  );
}

describe("CommandPalette", () => {
  it("opens with Ctrl+K, filters, and runs the active command with Enter", async () => {
    const goEvents = vi.fn();
    const goPractice = vi.fn();
    const pmk = vi.fn();
    render(
      <Harness
        commands={[
          { id: "events", label: "Events", group: "Go to", run: goEvents },
          {
            id: "practice",
            label: "Practice",
            group: "Go to",
            run: goPractice,
          },
          {
            id: "PMK",
            label: "Principles of Marketing",
            group: "Events",
            keywords: ["PMK"],
            run: pmk,
          },
        ]}
      />,
    );
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    expect(screen.getAllByRole("option")).toHaveLength(3);

    fireEvent.change(input, { target: { value: "pmk" } });
    const options = screen.getAllByRole("option");
    expect(options[0].textContent).toContain("Principles of Marketing");
    expect(options[0].getAttribute("aria-selected")).toBe("true");

    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(pmk).toHaveBeenCalledOnce());
    expect(goEvents).not.toHaveBeenCalled();
  });

  it("moves the active option with the arrow keys", async () => {
    render(
      <Harness
        commands={[
          { id: "a", label: "Events", group: "Go to", run: () => {} },
          { id: "b", label: "Practice", group: "Go to", run: () => {} },
        ]}
      />,
    );
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = input.getAttribute("aria-activedescendant") as string;
    expect(document.getElementById(active)?.textContent).toContain("Practice");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    const wrapped = input.getAttribute("aria-activedescendant") as string;
    expect(document.getElementById(wrapped)?.textContent).toContain("Events");
  });

  it("says plainly when nothing matches", async () => {
    render(
      <Harness
        commands={[{ id: "a", label: "Events", group: "Go to", run: () => {} }]}
      />,
    );
    fireEvent.keyDown(document, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("combobox", {
      name: "Search commands",
    });
    fireEvent.change(input, { target: { value: "qqq" } });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText(/Nothing matches/)).toBeTruthy();
  });
});
