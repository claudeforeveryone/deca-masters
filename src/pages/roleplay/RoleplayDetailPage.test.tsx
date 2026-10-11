import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Profile } from "../../api/profile";
import type { RoleplaySession } from "../../api/roleplay";
import { ToastProvider } from "../../components/ui/Toast";
import type { MemberState } from "../../lib/member";

const CLIENT = "00000000-0000-4000-8000-00000000c11e";
const SAVED_ID = "00000000-0000-4000-8000-0000000005a1";

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
vi.mock("../../api/events", () => ({ getEvent: vi.fn() }));
vi.mock("../../api/track", () => ({ track: vi.fn(async () => {}) }));
vi.mock("../../api/practice", () => ({
  newClientId: () => "00000000-0000-4000-8000-00000000c11e",
}));
vi.mock("../../api/roleplay", async (orig) => ({
  ...(await orig<typeof import("../../api/roleplay")>()),
  getRoleplayEvent: vi.fn(),
  getSession: vi.fn(),
  saveSession: vi.fn(),
  mySessions: vi.fn(),
  deleteSession: vi.fn(),
}));

import { getEvent } from "../../api/events";
import {
  getRoleplayEvent,
  getSession,
  mySessions,
  saveSession,
} from "../../api/roleplay";
import { track } from "../../api/track";
import { RoleplayDetailPage } from "./RoleplayDetailPage";

const EVENT = {
  code: "PMK",
  name: "Principles of Marketing",
  category: "Principles of Business Administration",
  cluster: "marketing" as const,
  exam: "business-admin-core" as const,
  components: ["exam" as const, "roleplay" as const],
  teamSize: "1",
  summary: "Summary.",
  officialUrl: "https://www.deca.org/compete/principles-of-marketing",
  verifiedAt: "2026-10-11",
  notes: null,
  format: {
    prepMinutes: 10,
    presentMinutes: 10,
    judgeAppearance: null,
    performanceIndicators: 4,
    writtenLimit: null,
    scoring: null,
  },
};
const ROLEPLAY = {
  eventCode: "PMK",
  eventName: "Principles of Marketing",
  cluster: "marketing" as const,
  status: "placeholder" as const,
  officialSamples: [
    {
      title: "Official sample event, 2026-27 format",
      url: "https://cdn.prod.website-files.com/635c470cc81318fc3e9c1e0e/sample.pdf",
      season: "2026-27",
      kind: "current-format-sample",
    },
  ],
  format: {
    prepMinutes: 10,
    presentationMinutes: 10,
    judgeRole: "A business executive.",
  },
  placeholder: true,
  note: null,
};

const session = (over: Partial<RoleplaySession> = {}): RoleplaySession => ({
  id: SAVED_ID,
  client_id: CLIENT,
  event_code: "PMK",
  scenario_ref: null,
  scenario_title: null,
  prep_seconds: 0,
  present_seconds: 0,
  ratings: [],
  notes: null,
  completed_at: "2026-10-11T15:00:00Z",
  created_at: "2026-10-11T15:00:00Z",
  updated_at: "2026-10-11T15:00:00Z",
  ...over,
});

function Probe() {
  const loc = useLocation();
  return <output data-testid="loc">{loc.pathname + loc.search}</output>;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ToastProvider>
        <Routes>
          <Route path="/roleplay/:id" element={<RoleplayDetailPage />} />
        </Routes>
        <Probe />
      </ToastProvider>
    </MemoryRouter>,
  );
}

const ready = (): MemberState => ({
  status: "ready",
  uid: "u1",
  profile: { id: "u1", events: [] } as unknown as Profile,
});
const advance = (ms: number) =>
  act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  member.state = { status: "signed-out" };
  vi.mocked(getEvent).mockResolvedValue(EVENT);
  vi.mocked(getRoleplayEvent).mockResolvedValue(ROLEPLAY);
  vi.mocked(mySessions).mockResolvedValue([]);
  vi.mocked(saveSession).mockImplementation(async (input) =>
    session({
      prep_seconds: input.prepSeconds ?? 0,
      notes: input.notes ?? null,
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("role-play trainer", () => {
  it("times prep for a visitor and saves nothing", async () => {
    renderAt("/roleplay/PMK");
    await screen.findByRole("heading", {
      level: 1,
      name: "Principles of Marketing",
    });
    expect(screen.getByRole("timer").textContent).toBe("10:00");
    fireEvent.click(screen.getByRole("button", { name: "Start prep" }));
    await advance(5000);
    expect(screen.getByRole("timer").textContent).toBe("09:55");
    expect(saveSession).not.toHaveBeenCalled();
    expect(
      screen.getByText("Not saved: sign in to keep this session."),
    ).toBeTruthy();
    expect(track).toHaveBeenCalledWith("practice_started", "PMK", {
      mode: "roleplay",
    });
  });

  it("saves as you go once the clock starts, notes included, and puts the session in the URL", async () => {
    member.state = ready();
    renderAt("/roleplay/PMK");
    await screen.findByRole("heading", {
      level: 1,
      name: "Principles of Marketing",
    });
    fireEvent.click(
      screen.getByRole("radio", { name: /Official sample event/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Start prep" }));
    await advance(2000);
    expect(saveSession).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveSession).mock.calls[0][0]).toMatchObject({
      clientId: CLIENT,
      eventCode: "PMK",
      scenarioRef: ROLEPLAY.officialSamples[0].url,
      scenarioTitle: ROLEPLAY.officialSamples[0].title,
    });
    expect(screen.getByTestId("loc").textContent).toBe(
      `/roleplay/PMK?session=${SAVED_ID}`,
    );

    // Typing while the clock runs still saves (the ticking clock must not hold the save back).
    fireEvent.change(screen.getByRole("textbox", { name: "Prep notes" }), {
      target: { value: "Open with the problem." },
    });
    await advance(2000);
    const last = vi.mocked(saveSession).mock.calls.at(-1)![0];
    expect(last.clientId).toBe(CLIENT);
    expect(last.notes).toBe("## Prep notes\nOpen with the problem.");
    // The trainer kept its clock: it did not reload when the URL gained the session id.
    expect(screen.getByRole("timer").textContent).not.toBe("10:00");
  });

  it("saves a self-rating per indicator", async () => {
    member.state = ready();
    renderAt("/roleplay/PMK");
    await screen.findByRole("heading", {
      level: 1,
      name: "Principles of Marketing",
    });
    fireEvent.change(screen.getByRole("textbox", { name: "PI 1" }), {
      target: { value: "Explain the nature of positioning" },
    });
    const group = screen.getByRole("radiogroup", { name: "Rating for PI 1" });
    fireEvent.click(within(group).getByRole("radio", { name: "Meets" }));
    fireEvent.click(screen.getByRole("button", { name: "Save session" }));
    await advance(100);
    expect(vi.mocked(saveSession).mock.calls[0][0].ratings).toEqual([
      { key: "pi-1", level: 2, label: "Explain the nature of positioning" },
    ]);
  });

  it("opens a saved session from the URL with its notes, and offers a fresh one", async () => {
    member.state = ready();
    vi.mocked(getSession).mockResolvedValue(
      session({
        prep_seconds: 540,
        present_seconds: 600,
        ratings: [{ key: "pi-2", level: 3, label: "Describe pricing" }],
        notes:
          "## Prep notes\nThree options.\n## Judge questions\n- What is the budget?",
      }),
    );
    renderAt(`/roleplay/PMK?session=${SAVED_ID}`);
    await screen.findByRole("heading", {
      level: 1,
      name: "Principles of Marketing",
    });
    expect(
      (
        screen.getByRole("textbox", {
          name: "Prep notes",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("Three options.");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Judge question 1",
        }) as HTMLInputElement
      ).value,
    ).toBe("What is the budget?");
    expect(
      (screen.getByRole("textbox", { name: "PI 2" }) as HTMLInputElement).value,
    ).toBe("Describe pricing");
    expect(
      screen.queryByRole("button", { name: "Reset the clock" }),
    ).toBeNull();
    await advance(3000);
    expect(saveSession).not.toHaveBeenCalled(); // opening is not a change
    fireEvent.click(
      screen.getByRole("button", { name: "Start a new session" }),
    );
    await advance(50);
    expect(screen.getByTestId("loc").textContent).toBe("/roleplay/PMK");
    expect(
      (
        screen.getByRole("textbox", {
          name: "Prep notes",
        }) as HTMLTextAreaElement
      ).value,
    ).toBe("");
    expect(screen.getByRole("timer").textContent).toBe("10:00");
  });

  it("says when an event has no role play", async () => {
    vi.mocked(getRoleplayEvent).mockResolvedValue(null);
    renderAt("/roleplay/PMK");
    await screen.findByRole("heading", {
      level: 1,
      name: "PMK has no role play",
    });
  });
});
