import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  value: { loading: false, user: null as null | { id: string } },
}));
vi.mock("./auth", () => ({ useAuth: () => auth.value }));

const api = vi.hoisted(() => ({
  getMyProfile: vi.fn(),
  saveProfile: vi.fn(),
}));
vi.mock("../api/profile", () => api);

import type { Profile } from "../api/profile";
import {
  MAX_MY_EVENTS,
  resetMemberCache,
  toggleMyEvent,
  useMember,
} from "./member";
import { setMyProfile, useMyProfile } from "./profile";

const profile = (events: string[]): Profile =>
  ({ id: "u1", username: "sam", events }) as unknown as Profile;

beforeEach(() => {
  resetMemberCache();
  api.getMyProfile.mockReset();
  api.saveProfile.mockReset();
  auth.value = { loading: false, user: null };
});

describe("toggleMyEvent", () => {
  it("adds and removes codes, six at most", () => {
    expect(MAX_MY_EVENTS).toBe(6);
    expect(toggleMyEvent(["PMK"], "ACT")).toEqual({
      events: ["PMK", "ACT"],
      full: false,
    });
    expect(toggleMyEvent(["PMK", "ACT"], "PMK")).toEqual({
      events: ["ACT"],
      full: false,
    });
    const six = ["A", "B", "C", "D", "E", "F"];
    expect(toggleMyEvent(six, "G")).toEqual({ events: six, full: true });
  });
});

describe("useMember", () => {
  it("is signed out without asking for a profile", () => {
    const { result } = renderHook(() => useMember());
    expect(result.current.state.status).toBe("signed-out");
    expect(api.getMyProfile).not.toHaveBeenCalled();
  });

  it("waits while the session loads", () => {
    auth.value = { loading: true, user: null };
    const { result } = renderHook(() => useMember());
    expect(result.current.state.status).toBe("loading");
  });

  it("loads the profile once for every page that asks, and says when there is none", async () => {
    auth.value = { loading: false, user: { id: "u1" } };
    api.getMyProfile.mockResolvedValue(null);
    const a = renderHook(() => useMember());
    const b = renderHook(() => useMember());
    await waitFor(() =>
      expect(a.result.current.state.status).toBe("no-profile"),
    );
    expect(b.result.current.state.status).toBe("no-profile");
    expect(api.getMyProfile).toHaveBeenCalledTimes(1);
  });

  it("saves a change to your events and shows it everywhere", async () => {
    auth.value = { loading: false, user: { id: "u1" } };
    api.getMyProfile.mockResolvedValue(profile(["PMK"]));
    api.saveProfile.mockResolvedValue(profile(["PMK", "ACT"]));
    const { result } = renderHook(() => useMember());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    await act(() => result.current.setEvents(["PMK", "ACT"]));
    expect(api.saveProfile).toHaveBeenCalledWith({ events: ["PMK", "ACT"] });
    const s = result.current.state;
    expect(s.status === "ready" && s.profile.events).toEqual(["PMK", "ACT"]);
  });

  it("reports a failed load and can try again", async () => {
    auth.value = { loading: false, user: { id: "u1" } };
    api.getMyProfile.mockRejectedValueOnce(new Error("Network error."));
    api.getMyProfile.mockResolvedValueOnce(profile([]));
    const { result } = renderHook(() => useMember());
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    act(() => result.current.reload());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
  });
});

// The events, role-play and vocab pages (useMember) and the command centre, onboarding, profile and settings pages
// (useMyProfile) show one profile: a save on either side is what the other shows next, with no reload.
describe("one profile for every page", () => {
  it("asks the server once for both kinds of page", async () => {
    auth.value = { loading: false, user: { id: "u1" } };
    api.getMyProfile.mockResolvedValue(profile(["PMK"]));
    const member = renderHook(() => useMember());
    const mine = renderHook(() => useMyProfile());
    await waitFor(() => expect(member.result.current.state.status).toBe("ready"));
    await waitFor(() => expect(mine.result.current.status).toBe("ready"));
    expect(api.getMyProfile).toHaveBeenCalledTimes(1);
  });

  it("shows a profile saved by onboarding or settings on the events pages", async () => {
    auth.value = { loading: false, user: { id: "u1" } };
    api.getMyProfile.mockResolvedValue(null);
    const member = renderHook(() => useMember());
    await waitFor(() =>
      expect(member.result.current.state.status).toBe("no-profile"),
    );
    act(() => setMyProfile(profile(["ACT"])));
    const s = member.result.current.state;
    expect(s.status === "ready" && s.profile.events).toEqual(["ACT"]);
  });

  it("shows events added on an event page on the command centre and profile pages", async () => {
    auth.value = { loading: false, user: { id: "u1" } };
    api.getMyProfile.mockResolvedValue(profile(["PMK"]));
    api.saveProfile.mockResolvedValue(profile(["PMK", "ACT"]));
    const member = renderHook(() => useMember());
    const mine = renderHook(() => useMyProfile());
    await waitFor(() => expect(mine.result.current.status).toBe("ready"));
    await act(() => member.result.current.setEvents(["PMK", "ACT"]));
    expect(mine.result.current.profile?.events).toEqual(["PMK", "ACT"]);
  });

  it("keeps a save made while the first read is still on its way", async () => {
    auth.value = { loading: false, user: { id: "u1" } };
    let answer: (p: Profile | null) => void = () => {};
    api.getMyProfile.mockReturnValue(
      new Promise<Profile | null>((r) => {
        answer = r;
      }),
    );
    const member = renderHook(() => useMember());
    expect(member.result.current.state.status).toBe("loading");
    act(() => setMyProfile(profile(["ACT"])));
    await act(async () => answer(profile(["PMK"])));
    const s = member.result.current.state;
    expect(s.status === "ready" && s.profile.events).toEqual(["ACT"]);
  });
});
