// Several tabs on one run (BroadcastChannel, same browser). Each tab announces itself, so the page can say the run is
// open elsewhere; answers made in one tab show up in the others at once (the tab that made them saves them), and a
// submit or discard in one tab moves the others on. Different devices are not covered here: the server is the record
// there, and a save to a run finished elsewhere is refused and handled (src/lib/saveQueue.ts).
import type { LocalAnswer } from "./runSession";

export type RunMessage =
  | { t: "hello"; tab: string }
  | { t: "here"; tab: string }
  | { t: "bye"; tab: string }
  | { t: "answer"; tab: string; qid: string; answer: Partial<LocalAnswer> }
  | { t: "submitted"; tab: string; attemptId: string }
  | { t: "discarded"; tab: string };

type Outgoing =
  | { t: "answer"; qid: string; answer: Partial<LocalAnswer> }
  | { t: "submitted"; attemptId: string }
  | { t: "discarded" };

export type ChannelLike = {
  onmessage: ((e: { data: unknown }) => void) | null;
  postMessage: (data: unknown) => void;
  close: () => void;
};

const isChoice = (v: unknown) =>
  v === null || v === 0 || v === 1 || v === 2 || v === 3;

function answerOk(v: unknown): v is Partial<LocalAnswer> {
  if (!v || typeof v !== "object") return false;
  const a = v as Record<string, unknown>;
  return (
    (a.chosen === undefined || isChoice(a.chosen)) &&
    (a.flagged === undefined || typeof a.flagged === "boolean") &&
    (a.locked === undefined || typeof a.locked === "boolean") &&
    (a.correct === undefined ||
      a.correct === null ||
      typeof a.correct === "boolean") &&
    (a.correctChoice === undefined || isChoice(a.correctChoice)) &&
    (a.explanation === undefined ||
      a.explanation === null ||
      typeof a.explanation === "string") &&
    (a.ms === undefined || typeof a.ms === "number")
  );
}

/** A message from another tab, or null when it is not one this page sends. */
export function parseRunMessage(data: unknown): RunMessage | null {
  if (!data || typeof data !== "object") return null;
  const m = data as Record<string, unknown>;
  if (typeof m.tab !== "string") return null;
  switch (m.t) {
    case "hello":
    case "here":
    case "bye":
    case "discarded":
      return { t: m.t, tab: m.tab };
    case "answer":
      return typeof m.qid === "string" && answerOk(m.answer)
        ? { t: "answer", tab: m.tab, qid: m.qid, answer: m.answer }
        : null;
    case "submitted":
      return typeof m.attemptId === "string"
        ? { t: "submitted", tab: m.tab, attemptId: m.attemptId }
        : null;
    default:
      return null;
  }
}

/** Checked when a run opens, not at import, and a browser that refuses the channel just gets a run without tab sync. */
function browserChannel(name: string): ChannelLike | null {
  if (typeof BroadcastChannel === "undefined") return null;
  let bc: BroadcastChannel;
  try {
    bc = new BroadcastChannel(name);
  } catch {
    return null;
  }
  const ch: ChannelLike = {
    onmessage: null,
    postMessage: (data) => bc.postMessage(data),
    close: () => bc.close(),
  };
  bc.onmessage = (e: MessageEvent) => ch.onmessage?.({ data: e.data });
  return ch;
}

/** Opens the run's channel, or returns null where BroadcastChannel does not exist. */
export function openRunChannel(
  attemptId: string,
  handlers: {
    onMessage: (m: RunMessage) => void;
    /** How many other tabs have this run open. */
    onPeers: (count: number) => void;
  },
  make: (name: string) => ChannelLike | null = browserChannel,
) {
  const ch = make(`deca-masters:run:${attemptId}`);
  if (!ch) return null;
  const tab = Math.random().toString(36).slice(2, 10);
  const peers = new Set<string>();
  const send = (m: RunMessage) => ch.postMessage(m);

  ch.onmessage = (e) => {
    const m = parseRunMessage(e.data);
    if (!m || m.tab === tab) return;
    if (m.t === "hello" || m.t === "here") {
      const isNew = !peers.has(m.tab);
      peers.add(m.tab);
      if (m.t === "hello") send({ t: "here", tab });
      if (isNew) handlers.onPeers(peers.size);
      return;
    }
    if (m.t === "bye") {
      if (peers.delete(m.tab)) handlers.onPeers(peers.size);
      return;
    }
    handlers.onMessage(m);
  };
  send({ t: "hello", tab });

  return {
    tab,
    post(m: Outgoing) {
      send({ ...m, tab } as RunMessage);
    },
    close() {
      send({ t: "bye", tab });
      ch.onmessage = null;
      ch.close();
    },
  };
}

export type RunChannel = NonNullable<ReturnType<typeof openRunChannel>>;
