// Validates DECA content files against content/SCHEMA.md. The rules live in validate.mjs (pure, browser-safe);
// this file adds reading from disk and the command line.
//
//   node content/check.mjs                      every file under content/ (same as npm run check:content)
//   node content/check.mjs <file.json> [...]    just those files; the kind comes from their folder or shape
//
// Library: loadCorpus(dir) plus everything validate.mjs exports.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { auditCorpus, validateCorpus } from "./validate.mjs";

export * from "./validate.mjs";

const CONTENT_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Every .json file under dir as { path (relative to dir, forward slashes), doc }. A file that does not parse carries
 * parseError instead of doc. Archived folders are listed too, so validateCorpus can refuse them out loud.
 */
export function loadCorpus(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const full = join(d, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (name.endsWith(".json")) {
        const path = relative(dir, full).split(sep).join("/");
        try {
          out.push({ path, doc: JSON.parse(readFileSync(full, "utf8")) });
        } catch (err) {
          out.push({ path, doc: null, parseError: err.message });
        }
      }
    }
  };
  walk(dir);
  return out;
}

/** Prints errors and warnings for a list of entries; returns the error count. */
function report(entries, label) {
  const errors = validateCorpus(entries);
  const warnings = auditCorpus(entries);
  for (const w of warnings) console.log(`warn  ${w}`);
  if (errors.length)
    console.log(
      `FAIL  ${label}: ${errors.length} error(s)\n- ${errors.join("\n- ")}`,
    );
  else console.log(`OK    ${label}`);
  return errors.length;
}

const isMain = () =>
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain()) {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    const entries = loadCorpus(CONTENT_DIR);
    const bad = report(entries, `content/ (${entries.length} file(s))`);
    process.exit(bad ? 1 : 0);
  }
  let bad = 0;
  for (const file of files) {
    const full = resolve(file);
    // Keep the path relative to content/ when the file is inside it, so the folder decides the kind.
    const rel = relative(CONTENT_DIR, full);
    const path = rel.startsWith("..")
      ? full.split(sep).slice(-2).join("/")
      : rel.split(sep).join("/");
    let entry;
    try {
      entry = { path, doc: JSON.parse(readFileSync(full, "utf8")) };
    } catch (err) {
      entry = { path, doc: null, parseError: err.message };
    }
    bad += report([entry], file) ? 1 : 0;
  }
  process.exit(bad ? 1 : 0);
}
