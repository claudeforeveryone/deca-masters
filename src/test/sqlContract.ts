// Checks recorded Supabase calls (src/test/supabaseMock.ts) against the SQL in supabase/migrations, so a mocked API
// test also proves the call would reach a real function or column a signed-in member may use:
//   rpc    the public function exists, every argument is one of its parameters, every parameter without a default is
//          passed, and `authenticated` is granted execute
//   tables every column read, filtered or ordered on is granted to `authenticated` for select (Postgres needs that for
//          WHERE and ORDER BY too), inserted and updated columns have insert/update grants, deletes have delete
//
//   afterEach(() => expect(contractProblems(db.calls)).toEqual([]));
//
// The parser reads only the statement shapes these migrations use; it is a test aid, not a SQL parser.
import type { Recorded } from "./supabaseMock";

const files = import.meta.glob<string>("../../supabase/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

type Param = { name: string; required: boolean };
type Fn = { params: Param[]; executable: boolean };
type Table = {
  columns: Set<string>;
  select: Set<string>;
  insert: Set<string>;
  update: Set<string>;
  delete: boolean;
};
export type Schema = {
  functions: Map<string, Fn>;
  tables: Map<string, Table>;
};

const NOT_COLUMNS = new Set([
  "check",
  "unique",
  "primary",
  "constraint",
  "foreign",
  "exclude",
]);

function parse(): Schema {
  const sql = Object.keys(files)
    .sort()
    .map((k) => files[k].replace(/\r\n/g, "\n"))
    .join("\n");
  const functions = new Map<string, Fn>();
  // Shared with FBLA (its platform migration), not in DECA's files: no parameters, callable by members.
  functions.set("is_platform_owner", { params: [], executable: true });

  for (const m of sql.matchAll(
    /create or replace function public\.(\w+)\s*\(([\s\S]*?)\)\s*returns/gi,
  )) {
    const params = m[2]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => ({
        name: p.split(/\s+/)[0],
        required: !/\bdefault\b/i.test(p),
      }));
    functions.set(m[1], { params, executable: false });
  }
  for (const m of sql.matchAll(
    /foreach f in array array\[([\s\S]*?)\]\s*loop([\s\S]*?)end loop/gi,
  )) {
    if (!/grant execute on function public\.%s to authenticated/i.test(m[2]))
      continue;
    for (const n of m[1].matchAll(/'(\w+)\(/g)) {
      const fn = functions.get(n[1]);
      if (fn) fn.executable = true;
    }
  }

  for (const m of sql.matchAll(
    /grant execute on function public\.(\w+)\s*\([^)]*\)\s+to\s+([a-z_, ]+)/gi,
  )) {
    const fn = functions.get(m[1]);
    if (fn && m[2].split(",").some((r) => r.trim() === "authenticated"))
      fn.executable = true;
  }

  const tables = new Map<string, Table>();
  for (const m of sql.matchAll(
    /create table if not exists public\.(\w+) \(\n([\s\S]*?)\n\);/g,
  )) {
    const columns = new Set<string>();
    for (const line of m[2].split("\n")) {
      // column lines are indented two spaces; continuation lines are indented further
      const c = /^ {2}([a-z_][a-z0-9_]*)\s/.exec(line);
      if (c && !NOT_COLUMNS.has(c[1])) columns.add(c[1]);
    }
    tables.set(m[1], {
      columns,
      select: new Set(),
      insert: new Set(),
      update: new Set(),
      delete: false,
    });
  }
  for (const m of sql.matchAll(
    /alter table public\.(\w+) add column (?:if not exists )?(\w+)/gi,
  ))
    tables.get(m[1])?.columns.add(m[2]);

  for (const m of sql.matchAll(
    /\b(grant|revoke)\s+([a-z, ]+?)(?:\s*\(([^)]*)\))?\s+on\s+(?:table\s+)?((?:public\.\w+\s*,\s*)*public\.\w+)\s+(?:to|from)\s+([a-z_, ]+)/gi,
  )) {
    const [, verb, privList, colList, tableList, roles] = m;
    if (!roles.split(",").some((r) => r.trim() === "authenticated")) continue;
    const privs = privList.split(",").map((p) => p.trim().toLowerCase());
    for (const name of tableList.split(",").map((t) => t.trim().slice(7))) {
      const t = tables.get(name);
      if (!t) continue;
      const cols = colList
        ? colList.split(",").map((c) => c.trim())
        : [...t.columns];
      const grant = verb.toLowerCase() === "grant";
      for (const p of privs.flatMap((x) =>
        x === "all" ? ["select", "insert", "update", "delete"] : [x],
      )) {
        if (p === "delete") t.delete = grant;
        else if (p === "select" || p === "insert" || p === "update")
          for (const c of cols)
            if (grant) t[p].add(c);
            else t[p].delete(c);
      }
    }
  }
  return { functions, tables };
}

let cached: Schema | null = null;
export function schema(): Schema {
  cached ??= parse();
  return cached;
}

const FILTERS = new Set([
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "in",
  "is",
  "like",
  "ilike",
  "order",
]);

function rpcProblems(rec: Recorded & { rpc: string }): string[] {
  const fn = schema().functions.get(rec.rpc);
  const where = `rpc ${rec.rpc}`;
  if (!fn) return [`${where}: no such public function in the migrations`];
  const out: string[] = [];
  if (!fn.executable)
    out.push(`${where}: not granted to authenticated in the migrations`);
  const args =
    rec.args && typeof rec.args === "object"
      ? Object.keys(rec.args as object)
      : [];
  const known = new Set(fn.params.map((p) => p.name));
  for (const a of args)
    if (!known.has(a)) out.push(`${where}: unknown parameter ${a}`);
  for (const p of fn.params)
    if (p.required && !args.includes(p.name))
      out.push(`${where}: missing required parameter ${p.name}`);
  return out;
}

function tableProblems(rec: Recorded & { table: string }): string[] {
  const t = schema().tables.get(rec.table);
  if (!t) return [`${rec.table}: no such table in the migrations`];
  const out: string[] = [];
  const need = (set: Set<string>, verb: string, col: string) => {
    if (!set.has(col)) out.push(`${rec.table}: cannot ${verb} ${col}`);
  };
  for (const [op, args] of rec.ops) {
    if (op === "select") {
      const list = typeof args[0] === "string" ? args[0] : "";
      for (const c of list.split(",").map((s) => s.trim()))
        if (c && c !== "*") need(t.select, "select", c);
    } else if (FILTERS.has(op)) {
      if (typeof args[0] === "string") need(t.select, "select", args[0]);
    } else if (op === "insert" || op === "update") {
      const rows = Array.isArray(args[0]) ? args[0] : [args[0]];
      for (const row of rows)
        for (const c of Object.keys((row ?? {}) as object))
          need(op === "insert" ? t.insert : t.update, op, c);
    } else if (op === "delete") {
      if (!t.delete) out.push(`${rec.table}: cannot delete`);
    }
  }
  return out;
}

/** Every way the recorded calls disagree with the migrations, in call order. Empty when they all match. */
export function contractProblems(calls: Recorded[]): string[] {
  return calls.flatMap((rec) =>
    rec.rpc
      ? rpcProblems(rec as Recorded & { rpc: string })
      : rec.table
        ? tableProblems(rec as Recorded & { table: string })
        : [],
  );
}
