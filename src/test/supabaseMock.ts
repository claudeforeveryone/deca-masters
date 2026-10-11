// A stand-in for src/lib/supabase in API tests. It records every rpc() / from() chain and answers with replies queued
// by the test, so a test can assert exactly what reaches PostgREST (function and parameter names must match the SQL
// signatures in supabase/migrations) without a network.
//
//   vi.mock("../lib/supabase", async () => (await import("../test/supabaseMock")).supabaseModule);
//   import { db } from "../test/supabaseMock";
//   beforeEach(() => db.reset());
//   db.reply({ ... });                       // next awaited call resolves to { data, error: null }
//   db.fail("deca: run not found", "P0002"); // next awaited call resolves to { data: null, error }
import { vi } from "vitest";

export type Recorded = {
  rpc?: string;
  table?: string;
  args?: unknown;
  /** Builder calls after rpc()/from(), in order: ["select", ["id, name"]], ["eq", ["kind", "event"]] ... */
  ops: [string, unknown[]][];
};

type Reply = {
  data: unknown;
  error: { message: string; code: string } | null;
  count?: number | null;
};

function createDb() {
  let calls: Recorded[] = [];
  let replies: Reply[] = [];
  let uid: string | null = "00000000-0000-4000-8000-0000000000aa";

  const next = (): Reply => replies.shift() ?? { data: null, error: null };

  function builder(rec: Recorded): unknown {
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === "then") {
            const res = next();
            return (ok: (v: Reply) => unknown, ko?: (e: unknown) => unknown) =>
              Promise.resolve(res).then(ok, ko);
          }
          return (...args: unknown[]) => {
            rec.ops.push([String(prop), args]);
            return proxy;
          };
        },
      },
    );
    return proxy;
  }

  const supabase = {
    rpc: vi.fn((name: string, args?: unknown) => {
      const rec: Recorded = { rpc: name, args, ops: [] };
      calls.push(rec);
      return builder(rec);
    }),
    from: vi.fn((table: string) => {
      const rec: Recorded = { table, ops: [] };
      calls.push(rec);
      return builder(rec);
    }),
    auth: {
      getSession: vi.fn(async () => ({
        data: { session: uid ? { user: { id: uid } } : null },
        error: null,
      })),
    },
  };

  return {
    supabase,
    get calls() {
      return calls;
    },
    /** The last recorded call. */
    get last(): Recorded {
      const c = calls[calls.length - 1];
      if (!c) throw new Error("no supabase call was made");
      return c;
    },
    get uid() {
      return uid;
    },
    /** `extra` adds fields such as `count` (a head request with count: "exact" answers with it). */
    reply(data: unknown, extra: { count?: number | null } = {}) {
      replies.push({ data, error: null, ...extra });
    },
    fail(message: string, code: string) {
      replies.push({ data: null, error: { message, code } });
    },
    signOut() {
      uid = null;
    },
    reset() {
      calls = [];
      replies = [];
      uid = "00000000-0000-4000-8000-0000000000aa";
      supabase.rpc.mockClear();
      supabase.from.mockClear();
    },
  };
}

export const db = createDb();
export const supabaseModule = { supabase: db.supabase };
