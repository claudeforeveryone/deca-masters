import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth, type AuthValue } from "./auth";

// Only Supabase Auth is faked. The owner console counts an account for DECA when its sign-up metadata says
// app = "deca" (deca_private.deca_accounts, deca_0006) or it has a DECA profile; FBLA counts every unmarked account
// as its own. So the DECA sign-up must always send the marker.
const fake = vi.hoisted(() => ({
  signUp: vi.fn(async (_args: unknown) => ({
    data: { user: { id: "u-1", identities: [{}] }, session: null },
    error: null,
  })),
}));

vi.mock("./supabase", () => ({
  appUrl: (path = "") => `http://localhost/${path.replace(/^\//, "")}`,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe() {} } },
      }),
      signUp: fake.signUp,
    },
  },
}));

function grab(): { current: AuthValue | null } {
  const ref: { current: AuthValue | null } = { current: null };
  function Probe() {
    ref.current = useAuth();
    return null;
  }
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );
  return ref;
}

beforeEach(() => fake.signUp.mockClear());

describe("signUp", () => {
  it("marks the new account as a DECA account in its sign-up metadata", async () => {
    const auth = grab();
    await act(async () => {
      await auth.current!.signUp(" student@example.com ", "a long password");
    });
    expect(fake.signUp).toHaveBeenCalledTimes(1);
    expect(fake.signUp.mock.calls[0][0]).toEqual({
      email: "student@example.com",
      password: "a long password",
      options: {
        emailRedirectTo: "http://localhost/onboarding",
        data: { app: "deca" },
      },
    });
  });
});
