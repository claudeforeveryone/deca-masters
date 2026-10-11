import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tabs } from "./Tabs";

const tabs = [
  { id: "exam", label: "Exams", panel: <p>exam panel</p> },
  { id: "roleplay", label: "Role play", panel: <p>roleplay panel</p> },
  { id: "vocab", label: "Vocab", panel: <p>vocab panel</p> },
];

describe("Tabs", () => {
  it("shows the first panel and marks its tab selected", () => {
    render(<Tabs label="Tools" tabs={tabs} />);
    expect(screen.getByRole("tab", { name: "Exams" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Exams" }).textContent).toBe("exam panel");
  });

  it("moves selection and focus with the arrow keys, wrapping at the ends", () => {
    render(<Tabs label="Tools" tabs={tabs} />);
    const first = screen.getByRole("tab", { name: "Exams" });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });
    const second = screen.getByRole("tab", { name: "Role play" });
    expect(document.activeElement).toBe(second);
    expect(second.getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("roleplay panel");
    fireEvent.keyDown(second, { key: "ArrowLeft" });
    fireEvent.keyDown(document.activeElement as Element, { key: "ArrowLeft" });
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Vocab" }));
  });

  it("jumps with Home and End and keeps only the selected tab in the tab order", () => {
    render(<Tabs label="Tools" tabs={tabs} />);
    const first = screen.getByRole("tab", { name: "Exams" });
    first.focus();
    fireEvent.keyDown(first, { key: "End" });
    const last = screen.getByRole("tab", { name: "Vocab" });
    expect(document.activeElement).toBe(last);
    expect(last.tabIndex).toBe(0);
    expect(first.tabIndex).toBe(-1);
    fireEvent.keyDown(last, { key: "Home" });
    expect(document.activeElement).toBe(first);
  });

  it("selects on click", () => {
    render(<Tabs label="Tools" tabs={tabs} />);
    fireEvent.click(screen.getByRole("tab", { name: "Vocab" }));
    expect(screen.getByRole("tabpanel").textContent).toBe("vocab panel");
  });
});
