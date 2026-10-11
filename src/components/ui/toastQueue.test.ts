import { describe, expect, it } from "vitest";
import { dismissToast, pushToast, type ToastItem } from "./toastQueue";

const t = (id: string): ToastItem => ({ id, message: id, tone: "info" });

describe("toast queue", () => {
  it("adds new toasts at the end", () => {
    expect(pushToast([t("a")], t("b")).map((x) => x.id)).toEqual(["a", "b"]);
  });
  it("keeps at most three, dropping the oldest", () => {
    const q = [t("a"), t("b"), t("c")];
    expect(pushToast(q, t("d")).map((x) => x.id)).toEqual(["b", "c", "d"]);
  });
  it("replaces a toast that reuses an id instead of stacking a duplicate", () => {
    const q = pushToast([t("a"), t("b")], { id: "a", message: "again", tone: "success" });
    expect(q.map((x) => x.id)).toEqual(["b", "a"]);
    expect(q[1].message).toBe("again");
  });
  it("removes a dismissed toast and leaves the rest", () => {
    expect(dismissToast([t("a"), t("b")], "a").map((x) => x.id)).toEqual(["b"]);
  });
});
