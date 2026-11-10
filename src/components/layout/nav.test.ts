import { describe, expect, it } from "vitest";
import { DESKTOP_NAV, PHONE_MORE, PHONE_NAV } from "./nav";

describe("phone navigation", () => {
  it("reaches every section the desktop bar has", () => {
    const phone = new Set([...PHONE_NAV, ...PHONE_MORE].map((i) => i.to));
    for (const item of DESKTOP_NAV) expect(phone.has(item.to)).toBe(true);
  });

  it("fits the five-column tab bar: four tabs and the More button", () => {
    expect(PHONE_NAV.length).toBe(4);
    expect(PHONE_MORE.length).toBeGreaterThan(0);
  });

  it("lists no page twice", () => {
    const all = [...PHONE_NAV, ...PHONE_MORE].map((i) => i.to);
    expect(new Set(all).size).toBe(all.length);
  });
});
