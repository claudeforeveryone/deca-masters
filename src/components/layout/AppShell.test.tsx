import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../App";
import { AuthProvider } from "../../lib/auth";

// Only the external system is faked: a Supabase auth client with one signed-in session. The real AuthProvider,
// RequireAuth and top bar run on top of it, so the test sees the same event order the browser does.
const fake = vi.hoisted(() => {
  type Listener = (event: string, session: unknown) => void;
  const state: { session: unknown; listener: Listener | null } = {
    session: null,
    listener: null,
  };
  const signedIn = () => ({
    access_token: "t",
    user: { id: "u-1", email: "student@example.com" },
  });
  return { state, signedIn };
});

vi.mock("../../lib/supabase", () => ({
  appUrl: (path = "") => `http://localhost/${path.replace(/^\//, "")}`,
  supabase: {
    auth: {
      getSession: async () => ({ data: { session: fake.state.session } }),
      onAuthStateChange: (cb: (event: string, session: unknown) => void) => {
        fake.state.listener = cb;
        return { data: { subscription: { unsubscribe() {} } } };
      },
      signOut: async () => {
        await Promise.resolve();
        fake.state.session = null;
        fake.state.listener?.("SIGNED_OUT", null);
        return { error: null };
      },
    },
  },
}));

function LocationProbe() {
  const loc = useLocation();
  return <output data-testid="location">{loc.pathname + loc.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
        <LocationProbe />
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Sign out lives in the account menu: open it, then pick the item. */
async function signOutFromMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Account" }));
  fireEvent.click(await screen.findByRole("menuitem", { name: "Sign out" }));
}

beforeEach(() => {
  fake.state.session = fake.signedIn();
  fake.state.listener = null;
});

describe("sign out", () => {
  it("from a members-only page lands on the home page, not on a sign-in prompt", async () => {
    renderAt("/me/settings");
    await screen.findByRole("heading", { level: 2, name: "Appearance" });

    await signOutFromMenu();

    await screen.findByRole("heading", { level: 1, name: "Walk in ready." });
    expect(screen.getByTestId("location").textContent).toBe("/");
  });

  it("from a public page stays on that page", async () => {
    renderAt("/terms");
    await screen.findByRole("heading", { level: 1, name: "Terms of Use" });

    await signOutFromMenu();

    await screen.findByRole("link", { name: "Sign in" });
    expect(screen.getByTestId("location").textContent).toBe("/terms");
  });

  it("then opening a members-only page asks to sign in and remembers the page", async () => {
    renderAt("/me/settings");
    await screen.findByRole("heading", { level: 2, name: "Appearance" });
    await signOutFromMenu();
    await screen.findByRole("heading", { level: 1, name: "Walk in ready." });

    fireEvent.click(screen.getAllByRole("link", { name: "Progress" })[0]);

    await screen.findByRole("heading", { level: 1, name: "Sign in" });
    expect(screen.getByTestId("location").textContent).toBe(
      `/login?next=${encodeURIComponent("/progress")}`,
    );
  });
});
