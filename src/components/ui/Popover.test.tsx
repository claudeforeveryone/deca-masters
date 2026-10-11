import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { Menu } from "./Popover";

function setup(onSignOut = vi.fn()) {
  render(
    <MemoryRouter>
      <Menu
        label="Account"
        trigger={(p) => (
          <button type="button" {...p}>
            Account
          </button>
        )}
        items={[
          { kind: "link", label: "Profile", to: "/me" },
          { kind: "radio", label: "Dark", checked: true, onSelect: () => {} },
          { kind: "radio", label: "Light", checked: false, onSelect: () => {} },
          { kind: "separator" },
          { kind: "action", label: "Sign out", onSelect: onSignOut },
        ]}
      />
    </MemoryRouter>,
  );
  return screen.getByRole("button", { name: "Account" });
}

describe("Menu", () => {
  it("opens from the keyboard on the first item and moves with the arrows", async () => {
    const trigger = setup();
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = screen.getByRole("menu", { name: "Account" });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("menuitem", { name: "Profile" }),
      ),
    );
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitemradio", { name: "Dark" }),
    );
    fireEvent.keyDown(menu, { key: "End" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Sign out" }),
    );
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(
      screen.getByRole("menuitem", { name: "Profile" }),
    );
  });

  it("marks the current choice and runs an action, then closes and returns focus", async () => {
    const onSignOut = vi.fn();
    const trigger = setup(onSignOut);
    fireEvent.click(trigger);
    expect(
      screen
        .getByRole("menuitemradio", { name: "Dark" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    expect(
      screen
        .getByRole("menuitemradio", { name: "Light" })
        .getAttribute("aria-checked"),
    ).toBe("false");
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes on Escape and gives focus back to the trigger", async () => {
    const trigger = setup();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() =>
      expect(document.activeElement?.getAttribute("role")).toBe("menuitem"),
    );
    fireEvent.keyDown(document.activeElement as Element, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("jumps to the next item starting with a typed letter", async () => {
    const trigger = setup();
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    const menu = screen.getByRole("menu");
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe("Profile"),
    );
    fireEvent.keyDown(menu, { key: "s" });
    expect(document.activeElement?.textContent).toBe("Sign out");
  });
});
