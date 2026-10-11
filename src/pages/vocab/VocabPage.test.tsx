import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../../api/profile";
import { resetContentCache } from "../../lib/content";
import type { MemberState } from "../../lib/member";

const member = vi.hoisted(() => ({
  state: { status: "signed-out" } as MemberState,
}));
vi.mock("../../lib/member", async (orig) => ({
  ...(await orig<typeof import("../../lib/member")>()),
  useMember: () => ({
    state: member.state,
    reload: vi.fn(),
    setEvents: vi.fn(),
  }),
}));
vi.mock("../../api/vocab", async (orig) => ({
  ...(await orig<typeof import("../../api/vocab")>()),
  listDeckMeta: vi.fn(),
  countTerms: vi.fn(),
  vocabSummary: vi.fn(),
}));

import { countTerms, listDeckMeta, vocabSummary } from "../../api/vocab";
import { VocabPage } from "./VocabPage";

const META = [
  {
    slug: "finance" as const,
    title: "Finance Cluster Exam",
    status: "sourced" as const,
    placeholderNote: null,
    updatedAt: "2026-10-11T00:00:00Z",
  },
  {
    slug: "marketing" as const,
    title: "Marketing Cluster Exam",
    status: "placeholder" as const,
    placeholderNote: null,
    updatedAt: "2026-10-11T00:00:00Z",
  },
];

beforeEach(() => {
  member.state = { status: "signed-out" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        season: "2026-2027",
        source: "test",
        disclaimer: null,
        events: [{ code: "PMK", exam: "marketing" }],
        exams: [],
        vocab: [],
        roleplays: [],
        officialSamples: false,
      }),
    })),
  );
  vi.mocked(listDeckMeta).mockResolvedValue(META);
  vi.mocked(countTerms).mockResolvedValue({ finance: 120, marketing: 7 });
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetContentCache();
  vi.clearAllMocks();
});

const renderPage = () =>
  render(
    <MemoryRouter>
      <VocabPage />
    </MemoryRouter>,
  );

describe("vocab decks", () => {
  it("shows a visitor every deck with its term count and no progress", async () => {
    renderPage();
    await screen.findByText("120 terms");
    expect(screen.getByText("7 terms")).toBeTruthy();
    expect(vocabSummary).not.toHaveBeenCalled();
    expect(screen.getByText("Placeholder")).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Study Finance Cluster Exam" })
        .getAttribute("href"),
    ).toBe("/vocab/finance");
    expect(screen.queryByText(/mastered/)).toBeNull();
  });

  it("shows a member's progress, their event's deck first, and what is due", async () => {
    member.state = {
      status: "ready",
      uid: "u1",
      profile: { id: "u1", events: ["PMK"] } as unknown as Profile,
    };
    vi.mocked(vocabSummary).mockResolvedValue([
      {
        deck: "finance",
        title: "Finance Cluster Exam",
        status: "sourced",
        terms: 120,
        seen: 30,
        mastered: 12,
        due: 0,
        last_reviewed_at: null,
      },
      {
        deck: "marketing",
        title: "Marketing Cluster Exam",
        status: "placeholder",
        terms: 7,
        seen: 7,
        mastered: 2,
        due: 3,
        last_reviewed_at: null,
      },
    ]);
    renderPage();
    await screen.findByText("For your events");
    expect(listDeckMeta).not.toHaveBeenCalled();
    const study = screen
      .getAllByRole("link")
      .filter((a) => /^(Study|Review) /.test(a.textContent ?? ""))
      .map((a) => a.textContent);
    expect(study).toEqual([
      "Review Marketing Cluster Exam",
      "Study Finance Cluster Exam",
    ]);
    expect(
      screen.getByRole("img", { name: "12 of 120 mastered, 30 studied" }),
    ).toBeTruthy();
  });

  it("offers a retry when the decks do not load", async () => {
    vi.mocked(listDeckMeta).mockRejectedValue(new Error("offline"));
    renderPage();
    await screen.findByText("The decks did not load");
    expect(screen.getByRole("button", { name: /Try again/ })).toBeTruthy();
  });
});
