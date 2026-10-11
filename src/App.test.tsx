import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { AuthProvider } from "./lib/auth";
import { resetContentCache } from "./lib/content";

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

afterEach(() => {
  vi.unstubAllGlobals();
  resetContentCache();
});

describe("route map, signed out", () => {
  it("shows the landing with sign-up, sign-in, the credits and the non-affiliation line", async () => {
    renderAt("/");
    await screen.findByRole("heading", { level: 1, name: "Walk in ready." });
    const main = screen.getByRole("main");
    // The hero and the closing scene both offer the same two actions.
    const create = within(main).getAllByRole("link", {
      name: "Create an account",
    });
    expect(create.length).toBe(2);
    for (const link of create) expect(link.getAttribute("href")).toBe("/signup");
    const signIn = within(main).getAllByRole("link", { name: "Sign in" });
    expect(signIn.length).toBe(2);
    for (const link of signIn) expect(link.getAttribute("href")).toBe("/login");
    const footer = screen.getByRole("contentinfo");
    expect(footer.textContent).toMatch(/Built with.*by Joseph & Kaden/);
    expect(footer.textContent).toMatch(/not affiliated with DECA Inc/);
    expect(footer.textContent).toMatch(/not endorsed or sponsored by DECA Inc/);
    expect(
      within(footer)
        .getByRole("link", { name: "Terms of Use" })
        .getAttribute("href"),
    ).toBe("/terms");
    expect(
      within(footer)
        .getByRole("link", { name: "Privacy Policy" })
        .getAttribute("href"),
    ).toBe("/privacy");
  });

  it.each([
    "/onboarding",
    "/practice",
    "/practice/run?exam=marketing",
    "/practice/review/abc",
    "/progress",
    "/leaderboard",
    "/me",
    "/me/settings",
    "/owner",
  ])(
    "sends %s to sign in and remembers where the visitor was going",
    async (path) => {
      renderAt(path);
      await screen.findByRole("heading", { level: 1, name: "Sign in" });
      expect(screen.getByTestId("location").textContent).toBe(
        `/login?next=${encodeURIComponent(path)}`,
      );
    },
  );

  // /roleplay and /vocab are live tools now (src/pages/roleplay/*.test.tsx, src/pages/vocab/*.test.tsx).
  it.each([
    ["/terms", "Terms of Use"],
    ["/privacy", "Privacy Policy"],
  ])(
    "renders the public placeholder %s honestly, with no buttons",
    async (path, title) => {
      renderAt(path);
      await screen.findByRole("heading", { level: 1, name: title });
      const main = screen.getByRole("main");
      expect(within(main).getByText("Not live yet")).toBeTruthy();
      expect(within(main).queryByRole("button")).toBeNull();
    },
  );

  it.each(["/login", "/signup", "/reset"])(
    "renders the auth page %s",
    async (path) => {
      renderAt(path);
      const heading = await screen.findByRole("heading", { level: 1 });
      expect(heading.textContent).toMatch(
        /Sign in|Create your account|Reset your password/,
      );
    },
  );

  it("says an expired reset link has expired instead of showing a dead form", async () => {
    renderAt("/reset/update");
    await screen.findByRole("heading", {
      level: 1,
      name: "This link has expired",
    });
    expect(
      screen.getByRole("link", { name: "Get a new link" }).getAttribute("href"),
    ).toBe("/reset");
  });

  it("renders the not-found page for unknown addresses", async () => {
    renderAt("/no/such/page");
    await screen.findByRole("heading", { level: 1, name: "Page not found" });
  });
});

describe("events page", () => {
  it("says so honestly when no events are published", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          season: null,
          source: null,
          disclaimer: null,
          events: [],
          exams: [],
          vocab: [],
          roleplays: [],
          officialSamples: false,
        }),
      })),
    );
    renderAt("/events");
    await screen.findByRole("heading", { name: "No events published yet" });
  });

  it("lists published events with their cluster and links to each", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          season: "2026-2027",
          source: "test",
          disclaimer: null,
          events: [
            {
              code: "PMK",
              name: "Principles of Marketing",
              category: "Principles of Business Administration Events",
              cluster: "marketing",
              exam: "business-admin-core",
              components: ["exam", "roleplay"],
              teamSize: "1",
              summary: "A test summary.",
              officialUrl: "https://www.deca.org/compete",
              verifiedAt: "2026-10-11",
              notes: null,
            },
          ],
          exams: [],
          vocab: [],
          roleplays: [],
          officialSamples: false,
        }),
      })),
    );
    renderAt("/events");
    const link = await screen.findByRole("link", {
      name: /Principles of Marketing/,
    });
    expect(link.getAttribute("href")).toBe("/events/PMK");
    expect(link.textContent).toContain("Marketing");
  });

  it("shows an error when the content index cannot load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) })),
    );
    renderAt("/events");
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("The events did not load");
  });
});

describe("credits page", () => {
  const index = {
    season: "2026-2027",
    source: "deca.org event pages, checked 2026-10-11",
    disclaimer: null,
    events: [],
    exams: [],
    vocab: [],
    roleplays: [],
    officialSamples: false,
  };
  const serve = (credits: unknown) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => ({
        ok: true,
        json: async () => (url.endsWith("credits.json") ? credits : index),
      })),
    );

  it("is linked from the footer", async () => {
    renderAt("/");
    await screen.findByRole("heading", { level: 1 });
    expect(
      within(screen.getByRole("contentinfo"))
        .getByRole("link", { name: "Credits" })
        .getAttribute("href"),
    ).toBe("/credits");
  });

  it("says plainly when no outside content is published yet", async () => {
    serve({ sources: [] });
    renderAt("/credits");
    await screen.findByText(/No outside questions or vocab are published yet/);
    expect(screen.getByText(/deca\.org event pages, checked 2026-10-11/)).toBeTruthy();
  });

  it("lists each source with its licence, attribution and where it is used", async () => {
    serve({
      sources: [
        {
          title: "Principles of Marketing (open textbook)",
          url: "https://example.org/open-marketing",
          licence: "CC BY 4.0",
          attribution: "Example attribution line.",
          usedIn: ["Marketing Cluster Exam", "Marketing terms"],
        },
      ],
    });
    renderAt("/credits");
    const link = await screen.findByRole("link", {
      name: /Principles of Marketing \(open textbook\)/,
    });
    expect(link.getAttribute("href")).toBe("https://example.org/open-marketing");
    expect(screen.getByText("Example attribution line.")).toBeTruthy();
    expect(screen.getByText("CC BY 4.0")).toBeTruthy();
    expect(
      screen.getByText(/used in Marketing Cluster Exam, Marketing terms/),
    ).toBeTruthy();
  });
});

describe("event page", () => {
  const event = {
    code: "PMK",
    name: "Principles of Marketing",
    category: "Principles of Business Administration Events",
    cluster: "marketing",
    exam: "business-admin-core",
    components: ["exam", "roleplay"],
    teamSize: "1",
    summary: "A test summary.",
    officialUrl: "https://www.deca.org/compete/principles-of-marketing",
    verifiedAt: "2026-10-11",
    notes: null,
    officialCluster: "Marketing",
    format: {
      prepMinutes: 10,
      presentMinutes: 10,
      judgeAppearance: "1 role-play, a second for finalists",
      performanceIndicators: 4,
      writtenLimit: null,
      scoring: null,
    },
    guidelinesUrl:
      "https://cdn.prod.website-files.com/635c470cc81318fc3e9c1e0e/guidelines.pdf",
  };

  it("shows the checked format facts and links to the official pages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          season: "2026-2027",
          source: "test",
          disclaimer: null,
          events: [event],
          exams: [],
          vocab: [],
          roleplays: [],
          officialSamples: false,
        }),
      })),
    );
    renderAt("/events/pmk");
    await screen.findByRole("heading", { level: 1, name: "Principles of Marketing" });
    const facts = screen.getByRole("main");
    expect(within(facts).getByText("Prep").nextSibling?.textContent).toBe("10 min");
    expect(within(facts).getByText("With the judge").nextSibling?.textContent).toBe("10 min");
    expect(within(facts).getByText("Performance indicators").nextSibling?.textContent).toBe("4");
    expect(within(facts).getByText("1 role-play, a second for finalists")).toBeTruthy();
    // Unknown facts are left out, not guessed.
    expect(within(facts).queryByText("Scoring")).toBeNull();
    expect(
      screen.getByRole("link", { name: /Event guidelines/ }).getAttribute("href"),
    ).toBe(event.guidelinesUrl);
  });
});
