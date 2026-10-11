import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resetContentCache, type EventItem } from "../../lib/content";
import { LandingPage } from "./LandingPage";

const format = (
  prep: number | null,
  judge: number | null,
  pis: number | null,
) => ({
  prepMinutes: prep,
  presentMinutes: judge,
  judgeAppearance: null,
  performanceIndicators: pis,
  writtenLimit: null,
  scoring: null,
});

const event = (
  e: Partial<EventItem> &
    Pick<EventItem, "code" | "name" | "cluster" | "components">,
): EventItem => ({
  category: "Test category",
  exam: e.components.includes("exam") ? "marketing" : null,
  teamSize: "1",
  summary: "Test summary.",
  officialUrl: `https://www.deca.org/compete/${e.code.toLowerCase()}`,
  verifiedAt: "2026-10-11",
  notes: null,
  ...e,
});

const EVENTS: EventItem[] = [
  event({
    code: "ACT",
    name: "Accounting Applications Series",
    cluster: "finance",
    components: ["exam", "roleplay"],
    format: format(10, 10, 5),
  }),
  event({
    code: "FTDM",
    name: "Financial Services Team Decision Making",
    cluster: "finance",
    components: ["exam", "case-study"],
    teamSize: "2",
    format: format(30, 15, 7),
  }),
  event({
    code: "AAM",
    name: "Apparel and Accessories Marketing Series",
    cluster: "marketing",
    components: ["exam", "roleplay"],
    format: format(10, 10, 5),
  }),
  event({
    code: "IMCE",
    name: "Integrated Marketing Campaign-Event",
    cluster: "marketing",
    components: ["exam", "written", "presentation"],
    format: format(null, 15, null),
  }),
  event({
    code: "SMG",
    name: "Stock Market Game",
    cluster: "personal-finance",
    components: ["online", "simulation"],
    format: format(null, null, null),
  }),
];

function serve(events: EventItem[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({
        season: "2026-2027",
        source: "test",
        disclaimer: null,
        events,
        exams: [],
        vocab: [],
        roleplays: [],
        officialSamples: false,
      }),
    })),
  );
}

function renderLanding() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  resetContentCache();
});

describe("landing, with a published event list", () => {
  it("counts each format from the events, not from typed-in numbers", async () => {
    serve(EVENTS);
    renderLanding();
    await screen.findByText(/Computed from 5 events in the 2026-2027 season/);
    const board = screen.getByRole("table", { name: /event formats/ });
    const row = (name: string) =>
      within(board)
        .getByRole("rowheader", { name: new RegExp(name) })
        .closest("tr")!;
    expect(within(row("Role play")).getAllByRole("cell")[0].textContent).toBe(
      "2",
    );
    expect(within(row("Team case study")).getByText("30 min")).toBeTruthy();
    expect(within(row("Team case study")).getByText("Pairs")).toBeTruthy();
    expect(
      within(row("Online simulation")).getAllByRole("cell")[0].textContent,
    ).toBe("1");
  });

  it("lists the picked cluster's real events, each linking to its page", async () => {
    serve(EVENTS);
    renderLanding();
    const explorer = (
      await screen.findByRole("heading", {
        name: "Find your event by cluster.",
      })
    ).closest("section")!;
    // Marketing is picked first.
    await within(explorer).findByRole("link", { name: /AAM/ });
    expect(within(explorer).queryByRole("link", { name: /ACT/ })).toBeNull();

    fireEvent.click(within(explorer).getByRole("radio", { name: /Finance/ }));

    const act = within(explorer).getByRole("link", {
      name: /Accounting Applications Series/,
    });
    expect(act.getAttribute("href")).toBe("/events/ACT");
    expect(
      within(explorer).getByRole("link", { name: /FTDM/ }).getAttribute("href"),
    ).toBe("/events/FTDM");
    expect(
      within(explorer)
        .getByRole("link", { name: "Browse all 5 events" })
        .getAttribute("href"),
    ).toBe("/events");
  });

  it("runs the role-play clock from the event's published format", async () => {
    serve(EVENTS);
    renderLanding();
    await screen.findByText(/Computed from 5 events/);
    fireEvent.click(screen.getByRole("tab", { name: /Role-play trainer/ }));

    const timer = screen.getByRole("timer");
    expect(timer.textContent).toBe("10:00");
    expect(timer.getAttribute("aria-label")).toBe("Prep, 10:00 left");

    fireEvent.click(screen.getByRole("button", { name: /Skip to the judge/ }));
    expect(screen.getByRole("timer").getAttribute("aria-label")).toBe(
      "With the judge, 10:00 left",
    );

    // A team case study has its own timing.
    fireEvent.change(screen.getByLabelText("Event"), {
      target: { value: "FTDM" },
    });
    expect(screen.getByRole("timer").textContent).toBe("30:00");
    // Its performance indicators are a checklist you tick as you cover them, not seven lines of filler.
    const pis = screen.getByRole("group", { name: "7 performance indicators" });
    const ticks = within(pis).getAllByRole("button");
    expect(ticks.map((b) => b.textContent)).toEqual(
      Array.from({ length: 7 }, (_, i) => `PI ${i + 1}`),
    );
    expect(screen.queryByText(/Placeholder: indicator/)).toBeNull();
    fireEvent.click(ticks[0]);
    expect(ticks[0].getAttribute("aria-pressed")).toBe("true");
    expect(within(pis).getByText("1 of 7 covered")).toBeTruthy();
    expect(
      screen.getByText("Demo clock: runs here, saves nothing"),
    ).toBeTruthy();
  });
});

describe("landing, with nothing published", () => {
  it("says the list is not published instead of inventing numbers", async () => {
    serve([]);
    renderLanding();
    await screen.findByText(
      /The event list is not published yet, so there is nothing to count/,
    );
    expect(
      screen.getByText(/The event list is not published here yet. Until it is/),
    ).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Browse all/ })).toBeNull();
    // The two actions are always there.
    expect(
      screen.getAllByRole("link", { name: "Create an account" }).length,
    ).toBe(2);
    // An empty preview window carries no label about content it does not have.
    fireEvent.click(screen.getByRole("tab", { name: /Events/ }));
    expect(screen.queryByText("Real events")).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: /Role-play trainer/ }));
    expect(screen.queryByText(/Demo clock/)).toBeNull();
  });

  it("says the list did not load when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) })),
    );
    renderLanding();
    await screen.findByText(
      /The event list did not load, so the format board is empty/,
    );
  });
});
