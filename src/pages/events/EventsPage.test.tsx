import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../../api/profile";
import { ToastProvider } from "../../components/ui/Toast";
import { resetContentCache } from "../../lib/content";
import type { MemberState } from "../../lib/member";

const member = vi.hoisted(() => ({
  state: { status: "signed-out" } as MemberState,
  setEvents: vi.fn(),
}));
vi.mock("../../lib/member", async (orig) => ({
  ...(await orig<typeof import("../../lib/member")>()),
  useMember: () => ({
    state: member.state,
    reload: vi.fn(),
    setEvents: member.setEvents,
  }),
}));
const bookmarks = vi.hoisted(() => ({
  listBookmarks: vi.fn(),
  addBookmark: vi.fn(),
  removeBookmark: vi.fn(),
}));
vi.mock("../../api/bookmarks", () => bookmarks);

import { EventsPage } from "./EventsPage";

const ev = (
  code: string,
  name: string,
  cluster: string,
  over: object = {},
) => ({
  code,
  name,
  category: "Individual Series",
  cluster,
  exam: cluster,
  components: ["exam", "roleplay"],
  teamSize: "1",
  summary: `Summary of ${name}.`,
  officialUrl: "https://www.deca.org/compete/x",
  verifiedAt: "2026-10-11",
  notes: null,
  format: {
    prepMinutes: 10,
    presentMinutes: 10,
    judgeAppearance: null,
    performanceIndicators: 5,
    writtenLimit: null,
    scoring: null,
  },
  ...over,
});

const INDEX = {
  season: "2026-2027",
  source: "test",
  disclaimer: null,
  events: [
    ev("ACT", "Accounting Applications Series", "finance"),
    ev("BFS", "Business Finance Series", "finance"),
    ev("AAM", "Apparel and Accessories Marketing Series", "marketing"),
    ev("BTDM", "Buying and Merchandising Team Decision Making", "marketing", {
      category: "Team Decision Making",
      components: ["exam", "case-study"],
      teamSize: "2",
    }),
  ],
  exams: [],
  vocab: [],
  roleplays: [],
  officialSamples: false,
};

function Probe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.pathname + loc.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/events" element={<EventsPage />} />
        </Routes>
        <Probe />
      </ToastProvider>
    </MemoryRouter>,
  );
}


beforeEach(() => {
  member.state = { status: "signed-out" };
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => INDEX })),
  );
  bookmarks.listBookmarks.mockResolvedValue([]);
  bookmarks.addBookmark.mockResolvedValue(undefined);
  bookmarks.removeBookmark.mockResolvedValue(undefined);
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetContentCache();
  vi.clearAllMocks();
});

const eventLinks = () =>
  screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("href")?.startsWith("/events/"))
    .map((a) => a.getAttribute("href"));

describe("events explorer", () => {
  it("lists every event and, signed out, offers sign-in instead of saving", async () => {
    renderAt("/events");
    await screen.findByText("Accounting Applications Series");
    expect(eventLinks()).toEqual([
      "/events/AAM",
      "/events/ACT",
      "/events/BFS",
      "/events/BTDM",
    ]);
    expect(screen.getByText(/to bookmark events/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Bookmark/ })).toBeNull();
  });

  it("reads its filters from the URL and counts what is shown", async () => {
    renderAt("/events?cluster=finance");
    await screen.findByText("Accounting Applications Series");
    expect(eventLinks()).toEqual(["/events/ACT", "/events/BFS"]);
    expect(screen.getByText(/Showing/).textContent).toMatch(
      /Showing\s*2\s*of\s*4\s*events/,
    );
  });

  it("narrows by search and writes it to the URL", async () => {
    renderAt("/events");
    await screen.findByText("Accounting Applications Series");
    fireEvent.change(screen.getByRole("searchbox", { name: "Search events" }), {
      target: { value: "team decision" },
    });
    await waitFor(() => expect(eventLinks()).toEqual(["/events/BTDM"]));
    await waitFor(() =>
      expect(screen.getByTestId("loc").textContent).toBe(
        "/events?q=team+decision",
      ),
    );
  });

  it("filters by team size from the chips", async () => {
    renderAt("/events");
    await screen.findByText("Accounting Applications Series");
    const group = screen.getAllByRole("radiogroup", { name: "Team size" })[0];
    fireEvent.click(within(group).getByRole("radio", { name: /^Pairs/ }));
    await waitFor(() => expect(eventLinks()).toEqual(["/events/BTDM"]));
  });

  it("collects up to three events to compare and refuses a fourth", async () => {
    renderAt("/events");
    await screen.findByText("Accounting Applications Series");
    const compare = (code: string) =>
      fireEvent.click(screen.getByRole("button", { name: `Compare ${code}` }));
    compare("ACT");
    expect(screen.getByText("Pick one more")).toBeTruthy();
    compare("BFS");
    await waitFor(() =>
      expect(
        screen.getByRole("link", { name: "Compare 2" }).getAttribute("href"),
      ).toBe("/events/compare?codes=ACT,BFS"),
    );
    compare("AAM");
    compare("BTDM");
    await screen.findByText(
      "You can compare 3 events at a time. Remove one first.",
    );
    expect(screen.getByRole("link", { name: "Compare 3" })).toBeTruthy();
    expect(
      screen
        .getByRole("button", { name: "Compare BTDM" })
        .getAttribute("aria-pressed"),
    ).toBe("false");
  });

  it("bookmarks an event for a member and shows it pressed", async () => {
    member.state = {
      status: "ready",
      uid: "u1",
      profile: { id: "u1", events: ["ACT"] } as unknown as Profile,
    };
    renderAt("/events");
    await screen.findByText("Accounting Applications Series");
    const btn = await screen.findByRole("button", { name: "Bookmark AAM" });
    await waitFor(() => expect(btn.hasAttribute("disabled")).toBe(false));
    await act(async () => fireEvent.click(btn));
    expect(bookmarks.addBookmark).toHaveBeenCalledWith("event", "AAM");
    expect(btn.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getAllByText("Main event").length).toBeGreaterThan(0);
  });

  it("puts a bookmark back when the save fails", async () => {
    member.state = {
      status: "ready",
      uid: "u1",
      profile: { id: "u1", events: [] } as unknown as Profile,
    };
    bookmarks.addBookmark.mockRejectedValueOnce(
      new Error("Network error. Check your connection and try again."),
    );
    renderAt("/events");
    const btn = await screen.findByRole("button", { name: "Bookmark ACT" });
    await waitFor(() => expect(btn.hasAttribute("disabled")).toBe(false));
    await act(async () => fireEvent.click(btn));
    await screen.findByText(
      "Network error. Check your connection and try again.",
    );
    expect(btn.getAttribute("aria-pressed")).toBe("false");
  });
});

