import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PhoneActionBar, useOnScreen } from "./PhoneActionBar";

function Probe() {
  const [ref, onScreen] = useOnScreen<HTMLButtonElement>();
  return (
    <>
      <button ref={ref}>Start</button>
      <PhoneActionBar show={!onScreen}>
        <button>Start from the bar</button>
      </PhoneActionBar>
    </>
  );
}

describe("PhoneActionBar", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("stays out of the way where the browser cannot watch the action", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Probe />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("shows while the action is off the screen and leaves when it returns", () => {
    let report: (entries: { isIntersecting: boolean }[]) => void = () => {};
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(cb: typeof report) {
          report = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    render(<Probe />);
    expect(screen.queryByText("Start from the bar")).toBeNull();
    act(() => report([{ isIntersecting: false }]));
    expect(screen.getByText("Start from the bar")).toBeTruthy();
    act(() => report([{ isIntersecting: true }]));
    expect(screen.queryByText("Start from the bar")).toBeNull();
  });
});
