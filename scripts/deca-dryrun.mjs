// Builds DECA's backend dry run:
//   BEGIN; <deca_* migrations>; <tests/fixtures/content loaded>; <supabase/tests/deca_impersonation.sql>; ROLLBACK;
// Run the output with the Supabase MCP execute_sql tool on project uhgzeuvybyohdbfuhfil (it returns the last result:
// one row per check, every row must have ok = true), or pipe it into a local PostgreSQL 17 that has
// supabase/tests/local_supabase_stub.sql applied. Nothing persists: every migration, fixture and write is rolled back.
//
//   node scripts/deca-dryrun.mjs                 every migration + fixtures + tests
//   node scripts/deca-dryrun.mjs --from 4        only migrations deca_0004 and later (earlier ones already applied)
//   node scripts/deca-dryrun.mjs --only 3        just deca_0003 (combine with --no-tests for a syntax-only pass)
//   node scripts/deca-dryrun.mjs --no-tests      migrations (and fixtures) only, still rolled back
//   node scripts/deca-dryrun.mjs --compact       drop comment lines and indentation (smaller paste)
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadCorpus } from "../content/check.mjs";
import { loadStatements } from "./load-content.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const num = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? Number(args[i + 1]) : null;
};
const from = num("--from");
const only = num("--only");

const dir = join(root, "supabase", "migrations");
const files = readdirSync(dir)
  .filter((f) => /^deca_\d{4}_.*\.sql$/.test(f))
  .filter((f) => {
    const n = Number(f.slice(5, 9));
    return (only === null || n === only) && (from === null || n >= from);
  })
  .sort();

const parts = ["begin;"];
for (const f of files)
  parts.push(`-- ==== ${f}`, readFileSync(join(dir, f), "utf8"));
if (!args.includes("--no-fixtures")) {
  const statements = loadStatements(
    loadCorpus(join(root, "tests", "fixtures", "content")),
    { sync: false },
  );
  parts.push(
    "-- ==== fixtures (tests/fixtures/content)",
    "create temp table deca_load_result (n serial, path text, result jsonb);",
    ...statements.map((s) => s.sql),
  );
}
if (!args.includes("--no-tests")) {
  parts.push(
    "-- ==== tests",
    readFileSync(
      join(root, "supabase", "tests", "deca_impersonation.sql"),
      "utf8",
    ),
  );
} else {
  parts.push("select 'migrations ok' as result;");
}
parts.push("rollback;");

let out = parts.join("\n") + "\n";
if (args.includes("--compact")) {
  out =
    out
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith("--"))
      .join("\n") + "\n";
}
process.stdout.write(out);
