// Turns content/ (the source of truth, with answer keys) into public/content/ (what any visitor's browser may read).
// Modelled on FBLA's scripts/build-content.mjs. Runs before dev and build; refuses to write if content/ is invalid.
//
// public/content/
//   index.json               events (public facts from deca.org), exam / vocab / role-play summaries with status
//   exams/<slug>.json        questions WITHOUT answer or explanation; each keeps its source + licence for the UI
//   vocab/<slug>.json        terms with definitions and per-term credits (nothing to hide in a glossary)
//   roleplays/<cluster>.json links to DECA's official samples plus timing (links only, by schema)
//   official-samples.json    DECA's official sample-exam links, copied as is
//   credits.json             every source once, with where it is used (the credits page reads it)
//
// Answer keys and explanations stay server-side: the deca-backend track loads content/ into deca_questions, where
// grading and reveals happen in SECURITY DEFINER RPCs (FBLA migration 0014 pattern). Shipping them here would let
// anyone read every key before a timed run.
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  EXAMS,
  auditCorpus,
  kindOf,
  loadCorpus,
  validateCorpus,
} from "../content/check.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const write = (file, data) => {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data));
};

/** A per-item credit as the browser shows it. keyFrom is an internal provenance note and stays out. */
const publicCredit = ({ title, url, licence, attribution, adapted }) => ({
  title,
  url,
  licence,
  attribution,
  adapted,
});

const EXAM_ORDER = Object.keys(EXAMS);
const bySlug = (a, b) =>
  EXAM_ORDER.indexOf(a.slug) - EXAM_ORDER.indexOf(b.slug);

/** Builds public/content. Returns counts for the CLI and the tests; `warnings` are printed, never fatal. */
export function buildContent({
  srcDir = join(root, "content"),
  outDir = join(root, "public", "content"),
  onWarning = () => {},
} = {}) {
  const entries = loadCorpus(srcDir);
  const errors = validateCorpus(entries);
  if (errors.length)
    throw new Error(
      `content is invalid, nothing written:\n- ${errors.join("\n- ")}`,
    );
  for (const w of auditCorpus(entries)) onWarning(w);

  // Generated output: start clean so deleted content does not linger.
  rmSync(outDir, { recursive: true, force: true });

  const index = {
    season: null,
    source: null,
    disclaimer: null,
    events: [],
    exams: [],
    vocab: [],
    roleplays: [],
    officialSamples: false,
  };
  const counts = {
    events: 0,
    questions: 0,
    vocab: 0,
    roleplayEvents: 0,
    sources: 0,
  };
  const credits = new Map(); // url -> credit with usedIn
  const credit = (s, usedIn) => {
    const c = credits.get(s.url) ?? {
      title: s.title,
      url: s.url,
      licence: s.licence,
      attribution: s.attribution,
      usedIn: [],
    };
    if (!c.usedIn.includes(usedIn)) c.usedIn.push(usedIn);
    credits.set(s.url, c);
  };

  for (const { path, doc } of entries) {
    const kind = kindOf(doc, path);
    if (kind === "events") {
      index.season = doc.season;
      index.source = doc.source;
      index.disclaimer = doc.disclaimer ?? null;
      index.events = doc.events;
      counts.events = doc.events.length;
    } else if (kind === "exam") {
      const questions = doc.questions.map(
        ({ id, area, pi, difficulty, stem, choices, source }) => ({
          id,
          area,
          pi: pi ?? null,
          difficulty: difficulty ?? null,
          stem,
          choices,
          source: publicCredit(source),
        }),
      );
      write(join(outDir, "exams", `${doc.slug}.json`), {
        slug: doc.slug,
        title: doc.title,
        cluster: doc.cluster,
        blurb: doc.blurb,
        disclaimer: doc.disclaimer,
        status: doc.status,
        placeholderNote: doc.placeholderNote ?? null,
        sources: doc.sources,
        questions,
      });
      const areas = new Map();
      for (const q of questions)
        areas.set(q.area, (areas.get(q.area) ?? 0) + 1);
      index.exams.push({
        slug: doc.slug,
        title: doc.title,
        cluster: doc.cluster,
        status: doc.status,
        placeholderNote: doc.placeholderNote ?? null,
        questions: questions.length,
        areas: [...areas].map(([name, count]) => ({ name, count })),
      });
      for (const s of doc.sources) credit(s, doc.title);
      counts.questions += questions.length;
    } else if (kind === "vocab") {
      const terms = doc.terms.map(({ id, term, definition, area, source }) => ({
        id,
        term,
        definition,
        area,
        source: publicCredit(source),
      }));
      write(join(outDir, "vocab", `${doc.slug}.json`), {
        slug: doc.slug,
        title: doc.title,
        status: doc.status,
        placeholderNote: doc.placeholderNote ?? null,
        sources: doc.sources,
        terms,
      });
      index.vocab.push({
        slug: doc.slug,
        title: doc.title,
        status: doc.status,
        placeholderNote: doc.placeholderNote ?? null,
        terms: terms.length,
      });
      for (const s of doc.sources) credit(s, doc.title);
      counts.vocab += terms.length;
    } else if (kind === "roleplay") {
      write(join(outDir, "roleplays", `${doc.cluster}.json`), doc);
      index.roleplays.push({
        cluster: doc.cluster,
        status: doc.status,
        events: doc.events.length,
      });
      counts.roleplayEvents += doc.events.length;
    } else if (kind === "official-samples") {
      write(join(outDir, "official-samples.json"), doc);
      index.officialSamples = true;
    }
  }

  index.exams.sort(bySlug);
  index.vocab.sort(bySlug);
  const sources = [...credits.values()].sort((a, b) =>
    a.title.localeCompare(b.title),
  );
  counts.sources = sources.length;
  write(join(outDir, "credits.json"), { sources });
  write(join(outDir, "index.json"), index);
  return counts;
}

const isMain = () =>
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain()) {
  const c = buildContent({ onWarning: (w) => console.log(`warn  ${w}`) });
  console.log(
    `content: ${c.events} events, ${c.questions} exam questions, ${c.vocab} vocab terms, ` +
      `${c.roleplayEvents} role-play event links, ${c.sources} credited sources -> public/content`,
  );
}
