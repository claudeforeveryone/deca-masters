import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SettingsPage } from "./SettingsPage";

afterEach(() => {
  delete document.documentElement.dataset.theme;
});

describe("appearance setting", () => {
  it("switches the theme at once and keeps it for the next visit on this device", () => {
    const first = render(<SettingsPage />);
    expect(
      (screen.getByLabelText("Match my device") as HTMLInputElement).checked,
    ).toBe(true);

    fireEvent.click(screen.getByLabelText("Dark"));
    expect(document.documentElement.dataset.theme).toBe("dark");

    first.unmount();
    render(<SettingsPage />);
    expect((screen.getByLabelText("Dark") as HTMLInputElement).checked).toBe(
      true,
    );
  });
});
