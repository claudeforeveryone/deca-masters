import { describe, expect, it } from "vitest";
import { AuthFlowError, authErrorKind, authErrorMessage, classifyAuthError, toAuthError } from "./authErrors";

// Shapes copied from what supabase-js 2 throws (AuthApiError has message, code, status).
const err = (message: string, code?: string, status = 400) => ({ message, code, status });

describe("classifyAuthError", () => {
  it("reads the hourly email quota and the per-address cooldown apart", () => {
    expect(classifyAuthError(err("email rate limit exceeded", "over_email_send_rate_limit", 429)).kind).toBe("email_limit");
    const cooldown = classifyAuthError(
      err("For security purposes, you can only request this after 42 seconds.", "over_email_send_rate_limit", 429),
    );
    expect(cooldown).toMatchObject({ kind: "email_cooldown", wait: 42 });
  });

  it("recognises the common sign-in and sign-up failures", () => {
    expect(classifyAuthError(err("Invalid login credentials", "invalid_credentials")).kind).toBe("bad_credentials");
    expect(classifyAuthError(err("Email not confirmed", "email_not_confirmed")).kind).toBe("not_confirmed");
    expect(classifyAuthError(err("User already registered", "user_already_exists", 422)).kind).toBe("exists");
    expect(classifyAuthError(err("Password should be at least 8 characters.", "weak_password", 422)).kind).toBe("weak_password");
    expect(classifyAuthError(err("Request rate limit reached", "over_request_rate_limit", 429)).kind).toBe("request_limit");
    expect(classifyAuthError(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(classifyAuthError("something odd").kind).toBe("other");
    expect(classifyAuthError(null).kind).toBe("other");
  });
});

describe("authErrorMessage", () => {
  it("tells a person what happened and what to do, per flow", () => {
    const quota = err("email rate limit exceeded", "over_email_send_rate_limit", 429);
    expect(authErrorMessage(quota, "signup")).toMatch(/account was not created/);
    expect(authErrorMessage(quota, "reset")).toMatch(/reset link again in about an hour/);
    expect(authErrorMessage(err("Invalid login credentials", "invalid_credentials"), "signin")).toBe(
      "That email and password do not match. Try again, or reset your password.",
    );
    expect(
      authErrorMessage(err("For security purposes, you can only request this after 9 seconds.", undefined, 429), "resend"),
    ).toBe("We just sent an email to this address. Wait 9 seconds before asking for another.");
  });

  it("never shows raw server text for unknown errors", () => {
    expect(authErrorMessage(err("pq: relation auth.users does not exist", "unexpected_failure", 500), "signin")).toBe(
      "Something went wrong. Try again in a moment.",
    );
  });
});

describe("toAuthError", () => {
  it("keeps the kind so pages can branch on it", () => {
    const e = toAuthError(err("Email not confirmed", "email_not_confirmed"), "signin");
    expect(e).toBeInstanceOf(AuthFlowError);
    expect(authErrorKind(e)).toBe("not_confirmed");
    expect(e.message).toMatch(/confirm your email/i);
    expect(authErrorKind(new Error("plain"))).toBe("other");
  });
});
