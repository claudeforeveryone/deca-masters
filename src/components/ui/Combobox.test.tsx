import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Combobox } from "./Combobox";

const options = [
  { value: "ACT", label: "Accounting Applications Series", code: "ACT" },
  { value: "PMK", label: "Principles of Marketing", code: "PMK" },
  { value: "MCS", label: "Marketing Communications Series", code: "MCS" },
];

function Harness({ onPick }: { onPick: (v: string | null) => void }) {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Combobox
      label="Event"
      options={options}
      value={value}
      onChange={(v) => {
        setValue(v);
        onPick(v);
      }}
    />
  );
}

describe("Combobox", () => {
  it("filters as you type and picks the active option with Enter", () => {
    const onPick = vi.fn();
    render(<Harness onPick={onPick} />);
    const input = screen.getByRole("combobox", { name: "Event" });
    fireEvent.change(input, { target: { value: "princ" } });
    const list = screen.getByRole("listbox");
    const names = Array.from(list.querySelectorAll('[role="option"]')).map(
      (o) => o.textContent,
    );
    expect(names.some((n) => n?.includes("Accounting"))).toBe(false);
    expect(input.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    const active = input.getAttribute("aria-activedescendant");
    expect(active).toBeTruthy();
    expect(
      document.getElementById(active as string)?.getAttribute("aria-selected"),
    ).toBe("true");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPick).toHaveBeenCalledWith("PMK");
    expect((input as HTMLInputElement).value).toBe("Principles of Marketing");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("finds an event by its code", () => {
    render(<Harness onPick={() => {}} />);
    const input = screen.getByRole("combobox", { name: "Event" });
    fireEvent.change(input, { target: { value: "mcs" } });
    const first = screen.getAllByRole("option")[0];
    expect(first.textContent).toContain("Marketing Communications Series");
  });

  it("closes on Escape, and says so when nothing matches", () => {
    render(<Harness onPick={() => {}} />);
    const input = screen.getByRole("combobox", { name: "Event" });
    fireEvent.change(input, { target: { value: "zzzz" } });
    expect(screen.getByText("No matches")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });
});
