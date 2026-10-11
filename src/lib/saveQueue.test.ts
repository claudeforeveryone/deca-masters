import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ApiError, NETWORK_CODE } from "../api/core";
import type { AnswerInput } from "../api/practice";
import {
  classifyRunError,
  createSaveQueue,
  type QueueSnapshot,
  type SaveMeta,
  type TerminalKind,
} from "./saveQueue";

type Call = { answers: AnswerInput[]; meta: SaveMeta | null };

/** A send() whose replies the test controls, one deferred promise per call. */
function fakeServer() {
  const calls: Call[] = [];
  const pending: { resolve: () => void; reject: (e: unknown) => void }[] = [];
  const send = vi.fn(
    (answers: AnswerInput[], meta: SaveMeta | null) =>
      new Promise<void>((resolve, reject) => {
        calls.push({ answers, meta });
        pending.push({ resolve, reject });
      }),
  );
  return {
    send,
    calls,
    ok: async () => {
      pending.shift()!.resolve();
      await vi.advanceTimersByTimeAsync(0);
    },
    fail: async (e: unknown) => {
      pending.shift()!.reject(e);
      await vi.advanceTimersByTimeAsync(0);
    },
    get waiting() {
      return pending.length;
    },
  };
}

const offline = () =>
  new ApiError(
    "Network error. Check your connection and try again.",
    NETWORK_CODE,
  );
const ans = (
  id: string,
  chosen: 0 | 1 | 2 | 3 | null,
  flagged = false,
): AnswerInput => ({
  question_id: id,
  chosen,
  flagged,
  ms: 0,
});

let server: ReturnType<typeof fakeServer>;
let snaps: QueueSnapshot[];
let terminal: Mock<(kind: TerminalKind, error: unknown) => void>;
let unsent: AnswerInput[][];

function makeQueue() {
  return createSaveQueue({
    send: server.send,
    onChange: (s) => snaps.push(s),
    onTerminal: terminal,
    onUnsent: (a) => unsent.push(a),
  });
}
const last = () => snaps[snaps.length - 1];

beforeEach(() => {
  vi.useFakeTimers();
  server = fakeServer();
  snaps = [];
  terminal = vi.fn<(kind: TerminalKind, error: unknown) => void>();
  unsent = [];
});
afterEach(() => vi.useRealTimers());

describe("autosave", () => {
  it("saves every answer as soon as it is made", async () => {
    const q = makeQueue();
    q.push(ans("q1", 2));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].answers).toEqual([ans("q1", 2)]);
    expect(last().status).toBe("saving");
    await server.ok();
    expect(last()).toMatchObject({ status: "saved", pending: 0 });
  });

  it("sends one answer per question with its latest value when changes come in a burst", async () => {
    const q = makeQueue();
    q.push(ans("q1", 0));
    q.push(ans("q1", 3));
    q.push(ans("q2", 1));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0].answers).toEqual([ans("q1", 3), ans("q2", 1)]);
  });

  it("never lets an older save win: a change made while a save is in flight goes out after it", async () => {
    const q = makeQueue();
    q.push(ans("q1", 0));
    await vi.advanceTimersByTimeAsync(0);
    q.push(ans("q1", 2)); // changed while the first request is still out
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(1); // one request at a time
    await server.ok();
    expect(server.calls).toHaveLength(2);
    expect(server.calls[1].answers).toEqual([ans("q1", 2)]);
    await server.ok();
    expect(last()).toMatchObject({ status: "saved", pending: 0 });
  });

  it("carries the position and active time with each save", async () => {
    const q = makeQueue();
    q.setMeta({ position: 4, elapsedMs: 61_000 });
    q.push(ans("q5", 1));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls[0].meta).toEqual({ position: 4, elapsedMs: 61_000 });
  });

  it("never sends a place or time it was not given (a fresh tab must not reset the saved ones)", async () => {
    const q = makeQueue();
    q.push(ans("q2", 1));
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls[0].meta).toBeNull();
  });

  it("saves a position change on its own after a short pause, not on every keypress", async () => {
    const q = makeQueue();
    q.setMeta({ position: 1, elapsedMs: 1000 });
    q.setMeta({ position: 2, elapsedMs: 2000 });
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.calls).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1000);
    expect(server.calls).toHaveLength(1);
    expect(server.calls[0]).toEqual({
      answers: [],
      meta: { position: 2, elapsedMs: 2000 },
    });
  });
});

describe("losing the connection", () => {
  it("keeps unsent answers, says it is offline and retries with growing waits", async () => {
    const q = makeQueue();
    q.push(ans("q1", 1));
    await vi.advanceTimersByTimeAsync(0);
    await server.fail(offline());
    expect(last()).toMatchObject({
      status: "offline",
      pending: 1,
      retryInMs: 1000,
    });
    await vi.advanceTimersByTimeAsync(999);
    expect(server.calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(server.calls).toHaveLength(2);
    await server.fail(offline());
    expect(last().retryInMs).toBe(2000);
    await vi.advanceTimersByTimeAsync(2000);
    expect(server.calls).toHaveLength(3);
    await server.ok();
    expect(last()).toMatchObject({ status: "saved", pending: 0 });
  });

  it("merges answers made while offline and sends them all, latest value each, when the connection is back", async () => {
    const q = makeQueue();
    q.push(ans("q1", 1));
    await vi.advanceTimersByTimeAsync(0);
    await server.fail(offline());
    q.push(ans("q1", 3));
    q.push(ans("q2", 0, true));
    expect(last().pending).toBe(2);
    q.retryNow(); // the browser's online event
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls[1].answers).toEqual([ans("q1", 3), ans("q2", 0, true)]);
  });

  it("reports what is still unsent, so it can be kept on this device across a reload", async () => {
    const q = makeQueue();
    q.push(ans("q1", 1));
    expect(unsent.at(-1)).toEqual([ans("q1", 1)]);
    await vi.advanceTimersByTimeAsync(0);
    await server.ok();
    expect(unsent.at(-1)).toEqual([]);
  });

  it("does not wait out the backoff when told to retry now", async () => {
    const q = makeQueue();
    q.push(ans("q1", 1));
    await vi.advanceTimersByTimeAsync(0);
    await server.fail(offline());
    q.retryNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(2);
    await server.ok();
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.calls).toHaveLength(2); // the cancelled backoff timer does not fire a third save
  });
});

describe("errors that end autosave", () => {
  it("stops when the run was finished elsewhere (another tab or device submitted it)", async () => {
    const q = makeQueue();
    q.push(ans("q1", 1));
    await vi.advanceTimersByTimeAsync(0);
    await server.fail(new ApiError("This run is already finished", "22023"));
    expect(terminal).toHaveBeenCalledWith("finished", expect.any(ApiError));
    expect(last().status).toBe("stopped");
    q.push(ans("q2", 1));
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.calls).toHaveLength(1);
  });

  it("stops when the server says time is up, so the page can submit", async () => {
    const q = makeQueue();
    q.push(ans("q1", 1));
    await vi.advanceTimersByTimeAsync(0);
    await server.fail(
      new ApiError("Time is up. Submit the run to see your score", "22023"),
    );
    expect(terminal).toHaveBeenCalledWith("time_up", expect.any(ApiError));
  });

  it("retries other server errors a few times, then waits for the member to try again", async () => {
    const q = makeQueue();
    q.push(ans("q1", 1));
    await vi.advanceTimersByTimeAsync(0);
    const boom = new ApiError("Could not save your answers.", "XX000");
    await server.fail(boom);
    expect(last()).toMatchObject({ status: "retrying", retryInMs: 1000 });
    await vi.advanceTimersByTimeAsync(1000);
    await server.fail(boom);
    await vi.advanceTimersByTimeAsync(2000);
    await server.fail(boom);
    await vi.advanceTimersByTimeAsync(4000);
    await server.fail(boom);
    expect(last()).toMatchObject({
      status: "error",
      retryInMs: null,
      error: "Could not save your answers.",
      pending: 1,
    });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(server.calls).toHaveLength(4);
    q.retryNow();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(5);
  });
});

describe("handing over to submit", () => {
  it("sends nothing while paused and lets the page wait for a save already in flight", async () => {
    const q = makeQueue();
    q.push(ans("q1", 1));
    await vi.advanceTimersByTimeAsync(0);
    q.pause();
    q.push(ans("q2", 2));
    let settled = false;
    void q.settled().then(() => (settled = true));
    await vi.advanceTimersByTimeAsync(0);
    expect(settled).toBe(false);
    await server.ok();
    expect(settled).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(server.calls).toHaveLength(1); // q2 waits: the submit carries every answer anyway
    expect(q.unsent()).toEqual([ans("q2", 2)]);
  });

  it("can resume after a submit that did not go through", async () => {
    const q = makeQueue();
    q.pause();
    q.push(ans("q1", 1));
    q.resume();
    await vi.advanceTimersByTimeAsync(0);
    expect(server.calls).toHaveLength(1);
  });

  it("forgets unsent answers once the run is graded", async () => {
    const q = makeQueue();
    q.pause();
    q.push(ans("q1", 1));
    q.stop();
    expect(q.unsent()).toEqual([]);
    expect(unsent.at(-1)).toEqual([]);
  });
});

describe("classifyRunError", () => {
  it("sorts the server's run errors into what the page does next", () => {
    expect(classifyRunError(offline())).toBe("network");
    expect(
      classifyRunError(new ApiError("This run is already finished", "22023")),
    ).toBe("finished");
    expect(
      classifyRunError(new ApiError("This run was discarded", "22023")),
    ).toBe("finished");
    expect(
      classifyRunError(
        new ApiError("Time is up. Submit the run to see your score", "22023"),
      ),
    ).toBe("time_up");
    expect(classifyRunError(new ApiError("Run not found", "P0002"))).toBe(
      "not_found",
    );
    expect(classifyRunError(new ApiError("You are signed out", "42501"))).toBe(
      "signed_out",
    );
    expect(
      classifyRunError(
        new ApiError("Finish setting up your profile first", "42501"),
      ),
    ).toBe("signed_out");
    expect(
      classifyRunError(new ApiError("Could not save your answers.", null)),
    ).toBe("other");
  });
});
