import type { PostgrestError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { ApiError, NETWORK_CODE, isNetworkError, must, toApiError } from "./core";

// PostgrestError shape: message, code, details, hint.
const pg = (message: string, code: string) =>
  ({
  message,
  code,
  details: "",
  hint: "",
  name: "PostgrestError",
}) as unknown as PostgrestError;

describe("toApiError", () => {
  it("shows messages our own SQL raises on purpose, without the prefix", () => {
    expect(
      toApiError(pg("deca: that username is taken", "P0001")).message,
    ).toBe("That username is taken");
  });

  it("maps known codes to plain copy", () => {
    expect(
      toApiError(pg("permission denied for table deca_profiles", "42501"))
        .message,
    ).toBe("You don't have permission to do that.");
    expect(
      toApiError(
        pg("JSON object requested, multiple (or no) rows returned", "PGRST116"),
      ).message,
    ).toBe("Not found.");
  });

  it("never leaks raw database text", () => {
    const e = toApiError(
      pg('relation "deca_secret" does not exist', "42P01"),
      "Could not load your runs.",
    );
    expect(e.message).toBe("Could not load your runs.");
    expect(e.code).toBe("42P01");
  });

  it("names network failures", () => {
    expect(toApiError(new TypeError("Failed to fetch")).message).toMatch(
      /Network error/,
    );
  });

  it("marks network failures with their own code, so callers can retry them and nothing else", () => {
    // supabase-js reports a dropped connection as an error object whose message wraps the fetch TypeError
    const e = toApiError(pg("TypeError: Failed to fetch", ""));
    expect(e.code).toBe(NETWORK_CODE);
    expect(isNetworkError(e)).toBe(true);
    expect(isNetworkError(new TypeError("NetworkError when attempting to fetch resource."))).toBe(true);
    expect(isNetworkError(toApiError(pg("deca: run not found", "P0002")))).toBe(false);
    expect(isNetworkError(new Error("boom"))).toBe(false);
    expect(isNetworkError(null)).toBe(false);
  });
});

describe("must", () => {
  it("returns data or throws an ApiError", () => {
    expect(must({ data: 3, error: null })).toBe(3);
    expect(() => must({ data: null, error: pg("nope", "42501") })).toThrow(
      ApiError,
    );
  });
});
