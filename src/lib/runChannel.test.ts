import { describe, expect, it, vi } from "vitest";
import {
  openRunChannel,
  parseRunMessage,
  type ChannelLike,
} from "./runChannel";

/** BroadcastChannel semantics in memory: a post reaches every other channel with the same name, never the sender. */
function hub() {
  const all: {
    name: string;
    ch: ChannelLike & { deliver: (d: unknown) => void };
  }[] = [];
  return (name: string) => {
    const ch = {
      onmessage: null as ((e: { data: unknown }) => void) | null,
      postMessage(data: unknown) {
        for (const o of all)
          if (o.name === name && o.ch !== ch)
            o.ch.deliver(structuredClone(data));
      },
      close() {
        const i = all.findIndex((o) => o.ch === ch);
        if (i >= 0) all.splice(i, 1);
      },
      deliver(data: unknown) {
        ch.onmessage?.({ data });
      },
    };
    all.push({ name, ch });
    return ch;
  };
}

describe("openRunChannel", () => {
  it("lets each tab know the same run is open somewhere else", () => {
    const make = hub();
    const peersA = vi.fn();
    const peersB = vi.fn();
    const a = openRunChannel(
      "run1",
      { onMessage: vi.fn(), onPeers: peersA },
      make,
    )!;
    openRunChannel("run1", { onMessage: vi.fn(), onPeers: peersB }, make);
    expect(peersA).toHaveBeenLastCalledWith(1);
    expect(peersB).toHaveBeenLastCalledWith(1);
    a.close();
    expect(peersB).toHaveBeenLastCalledWith(0);
  });

  it("does not mix runs", () => {
    const make = hub();
    const peers = vi.fn();
    openRunChannel("run1", { onMessage: vi.fn(), onPeers: peers }, make);
    openRunChannel("run2", { onMessage: vi.fn(), onPeers: vi.fn() }, make);
    expect(peers).not.toHaveBeenCalledWith(1);
  });

  it("passes answers and the submit on to the other tabs", () => {
    const make = hub();
    const got = vi.fn();
    const a = openRunChannel(
      "run1",
      { onMessage: vi.fn(), onPeers: vi.fn() },
      make,
    )!;
    openRunChannel("run1", { onMessage: got, onPeers: vi.fn() }, make);
    a.post({ t: "answer", qid: "q1", answer: { chosen: 2, flagged: false } });
    a.post({ t: "submitted", attemptId: "run1" });
    expect(got).toHaveBeenCalledWith(
      expect.objectContaining({
        t: "answer",
        qid: "q1",
        answer: { chosen: 2, flagged: false },
      }),
    );
    expect(got).toHaveBeenCalledWith(
      expect.objectContaining({ t: "submitted", attemptId: "run1" }),
    );
  });

  it("works without BroadcastChannel (older browsers): no channel, nothing breaks", () => {
    expect(
      openRunChannel("run1", { onMessage: vi.fn(), onPeers: vi.fn() }, null),
    ).toBeNull();
  });
});

describe("parseRunMessage", () => {
  it("accepts the messages a run tab sends", () => {
    expect(parseRunMessage({ t: "hello", tab: "x" })).toEqual({
      t: "hello",
      tab: "x",
    });
    expect(parseRunMessage({ t: "discarded", tab: "x" })).toEqual({
      t: "discarded",
      tab: "x",
    });
    expect(
      parseRunMessage({
        t: "answer",
        tab: "x",
        qid: "q1",
        answer: {
          chosen: 1,
          flagged: true,
          locked: true,
          correct: false,
          correctChoice: 2,
          explanation: null,
        },
      }),
    ).toMatchObject({ t: "answer", qid: "q1" });
  });

  it("rejects anything else", () => {
    expect(parseRunMessage(null)).toBeNull();
    expect(
      parseRunMessage({
        t: "answer",
        tab: "x",
        qid: "q1",
        answer: { chosen: 9 },
      }),
    ).toBeNull();
    expect(parseRunMessage({ t: "nope", tab: "x" })).toBeNull();
    expect(parseRunMessage({ t: "hello" })).toBeNull();
  });
});
