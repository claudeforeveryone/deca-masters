import type { User } from "@supabase/supabase-js";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_LAYOUT,
  moveModule,
  toggleOpen,
  type BoardLayout,
} from "../../lib/board";
import { useSavedLayout } from "./useSavedLayout";

const save = vi.hoisted(() => vi.fn(async (_layout: BoardLayout) => {}));
vi.mock("../../api/dashboard", async (orig) => ({
  ...(await orig<typeof import("../../api/dashboard")>()),
  saveBoardLayout: save,
}));

const user = { id: "u-1", user_metadata: {} } as unknown as User;

beforeEach(() => {
  vi.useFakeTimers();
  save.mockClear();
});
afterEach(() => vi.useRealTimers());

describe("saving the board layout", () => {
  it("starts from the default layout and writes nothing until something changes", () => {
    const { result } = renderHook(() => useSavedLayout(user));
    expect(result.current.layout.order).toEqual(DEFAULT_LAYOUT.order);
    act(() => vi.advanceTimersByTime(2000));
    expect(save).not.toHaveBeenCalled();
  });

  it("writes a burst of moves once", async () => {
    const { result } = renderHook(() => useSavedLayout(user));
    act(() =>
      result.current.setLayout((l) => ({
        ...l,
        order: moveModule(l.order, "continue", 1),
      })),
    );
    act(() =>
      result.current.setLayout((l) => ({
        ...l,
        order: moveModule(l.order, "continue", 2),
      })),
    );
    await act(async () => vi.advanceTimersByTime(800));
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].order.indexOf("continue")).toBe(2);
    expect(result.current.save).toBe("saved");
  });

  it("still writes a change made just before the page is left", () => {
    const { result, unmount } = renderHook(() => useSavedLayout(user));
    act(() => result.current.setLayout((l) => toggleOpen(l, "streak")));
    act(() => vi.advanceTimersByTime(200));
    expect(save).not.toHaveBeenCalled();
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]![0].open).toEqual(["streak"]);
  });
});
