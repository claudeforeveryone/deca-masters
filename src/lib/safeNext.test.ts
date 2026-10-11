import { describe, expect, it } from "vitest";
import { nextParam, safeNext } from "./safeNext";

describe("safeNext", () => {
  it("keeps in-app paths, with their query", () => {
    expect(safeNext("/practice/run")).toBe("/practice/run");
    expect(safeNext("/me?tab=settings")).toBe("/me?tab=settings");
  });

  it("decodes a ?next= value written by nextParam", () => {
    const loc = { pathname: "/practice/run", search: "?exam=marketing" };
    expect(safeNext(nextParam(loc))).toBe("/practice/run?exam=marketing");
  });

  it("refuses anything that could leave the site", () => {
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext("/%5Cevil.example")).toBe("/");
    expect(safeNext("%2F%2Fevil.example")).toBe("/");
    expect(safeNext("/\t/evil.example")).toBe("/");
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("falls back on junk input", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null)).toBe("/");
    expect(safeNext("")).toBe("/");
    expect(safeNext(42)).toBe("/");
    expect(safeNext("%E0%A4%A")).toBe("/");
    expect(safeNext(undefined, "/onboarding")).toBe("/onboarding");
  });
});
