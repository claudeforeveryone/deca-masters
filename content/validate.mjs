// The content rules from content/SCHEMA.md (with its 2026-10-11 SOURCED CONTENT addendum), as pure functions.
// No Node imports: the build (scripts/build-content.mjs), the CLI (content/check.mjs) and the browser (the owner
// console's import screen) all run these same checks. Types for TypeScript callers: validate.d.mts.
//
// DECA Masters ships no AI-written questions, vocab or role plays. Every exam question and vocab term is reused from
// an openly licensed source (credited per item) or the file is a clearly labelled placeholder. Role-play files hold
// links to DECA's official public samples, never copied text.

export const EXAMS = {
  "business-admin-core": { cluster: "core", prefix: "core" },
  "business-management": { cluster: "business-management", prefix: "bma" },
  entrepreneurship: { cluster: "entrepreneurship", prefix: "ent" },
  finance: { cluster: "finance", prefix: "fin" },
  "hospitality-tourism": { cluster: "hospitality-tourism", prefix: "ht" },
  marketing: { cluster: "marketing", prefix: "mkt" },
  "personal-financial-literacy": { cluster: "personal-finance", prefix: "pfl" },
};
export const CLUSTERS = [
  "core",
  "business-management",
  "entrepreneurship",
  "finance",
  "hospitality-tourism",
  "marketing",
  "personal-finance",
];
export const COMPONENTS = [
  "exam",
  "roleplay",
  "case-study",
  "written",
  "presentation",
  "simulation",
  "portfolio",
  "online",
];
/** Licences whose terms allow reuse with attribution (SCHEMA.md). No-derivatives licences are not on the list. */
export const LICENCES = [
  "CC BY 4.0",
  "CC BY-SA 4.0",
  "CC BY-NC 4.0",
  "CC BY-NC-SA 4.0",
  "CC0",
  "Public domain (US federal work)",
];
export const STATUSES = ["sourced", "placeholder"];
export const KEY_FROM = ["source", "verified"];

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const EVENT_CODE = /^[A-Z][A-Z0-9]{1,6}$/;
const PI_CODE = /^[A-Z]{2}:\d{3}$/;
const VOCAB_ID = /^[a-z]{2,4}-v-\d{3,}$/;

const isStr = (v) => typeof v === "string" && v.trim().length > 0;
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ");
const isIntIn = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const nullOr = (v, test) => v === null || v === undefined || test(v);

function httpsUrl(v) {
  if (typeof v !== "string") return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u : null;
  } catch {
    return null;
  }
}

/**
 * True for a page DECA Inc. publishes: deca.org, decadirect.org, decaplus.org, DECA's own files on its website CDN
 * (the Webflow site id below), and DECA's Issuu account (the DECA Guide).
 */
export function isOfficialDecaUrl(v) {
  const u = httpsUrl(v);
  if (!u) return false;
  const host = u.hostname.replace(/^www\./, "");
  if (["deca.org", "decadirect.org", "decaplus.org"].includes(host))
    return true;
  if (host === "cdn.prod.website-files.com")
    return u.pathname.startsWith("/635c470cc81318fc3e9c1e0e/");
  if (host === "issuu.com") return u.pathname.startsWith("/decainc/");
  return false;
}

/** Errors for one credit object (a file's `sources` entry or an item's `source`). */
function checkCredit(c, tag, { item }) {
  if (!isObj(c)) return [`${tag}: source must be an object`];
  const e = [];
  if (!isStr(c.title)) e.push(`${tag}: source.title missing`);
  if (!httpsUrl(c.url)) e.push(`${tag}: source.url must be an https link`);
  if (!LICENCES.includes(c.licence))
    e.push(`${tag}: source.licence must be one of ${LICENCES.join(", ")}`);
  if (!isStr(c.attribution)) e.push(`${tag}: source.attribution missing`);
  if (item) {
    if (typeof c.adapted !== "boolean")
      e.push(`${tag}: source.adapted must be true or false`);
    if (!KEY_FROM.includes(c.keyFrom))
      e.push(`${tag}: source.keyFrom must be "source" or "verified"`);
  }
  return e;
}

/** status, sources and placeholderNote, shared by exam and vocab files. Returns the listed source URLs. */
function checkSourcing(doc, w, itemCount, noun) {
  const e = [];
  if (!STATUSES.includes(doc.status))
    e.push(`${w}: status must be "sourced" or "placeholder"`);
  const urls = new Set();
  if (!Array.isArray(doc.sources)) {
    e.push(`${w}: sources must be a list`);
  } else {
    // A "work" is a whole book, glossary or site; a page entry (one chapter, quiz or glossary entry an item cites)
    // names its work with partOf, so the credits page can credit the work once instead of every page.
    const works = new Map();
    for (const s of doc.sources)
      if (isObj(s) && typeof s.url === "string" && s.partOf === undefined)
        works.set(s.url, s);
    doc.sources.forEach((s, i) => {
      const tag = `${w} sources[${i}]`;
      e.push(...checkCredit(s, tag, { item: false }));
      if (isObj(s) && typeof s.url === "string") urls.add(s.url);
      if (!isObj(s) || s.partOf === undefined) return;
      const work = works.get(s.partOf);
      if (!work)
        e.push(
          `${tag}: partOf must be the url of a work listed in this file's sources`,
        );
      else if (s.licence !== work.licence)
        e.push(
          `${tag}: licence must match the work it is part of (${work.licence})`,
        );
    });
    if (doc.status === "sourced" && doc.sources.length === 0)
      e.push(`${w}: a sourced file must list its sources`);
  }
  if (doc.status === "placeholder" && !isStr(doc.placeholderNote))
    e.push(
      `${w}: placeholderNote is required on a placeholder (say what is missing and why)`,
    );
  if (!nullOr(doc.placeholderNote, isStr))
    e.push(`${w}: placeholderNote must be text or null`);
  if (doc.status === "sourced" && itemCount === 0)
    e.push(
      `${w}: a sourced ${noun} needs at least one ${noun === "exam" ? "question" : "term"}`,
    );
  return { e, urls };
}

function checkItemSource(item, tag, urls) {
  const e = checkCredit(item.source, tag, { item: true });
  if (
    isObj(item.source) &&
    httpsUrl(item.source.url) &&
    !urls.has(item.source.url)
  )
    e.push(`${tag}: source.url is not listed in this file's sources`);
  return e;
}

function checkEvents(doc, w) {
  const e = [];
  if (!isStr(doc.season)) e.push(`${w}: season missing`);
  if (!isStr(doc.source)) e.push(`${w}: source missing`);
  if (
    doc.sourceUrls !== undefined &&
    !(Array.isArray(doc.sourceUrls) && doc.sourceUrls.every(httpsUrl))
  )
    e.push(`${w}: sourceUrls must be a list of https links`);
  if (!nullOr(doc.disclaimer, isStr)) e.push(`${w}: disclaimer must be text`);
  const codes = new Set();
  doc.events.forEach((ev, i) => {
    const at = `${w} event ${i + 1}`;
    if (!isObj(ev)) {
      e.push(`${at}: not an object`);
      return;
    }
    if (!isStr(ev.code) || !EVENT_CODE.test(ev.code))
      e.push(`${at}: code must be 2-7 uppercase letters or digits`);
    else if (codes.has(ev.code)) e.push(`${at}: duplicate code ${ev.code}`);
    else codes.add(ev.code);
    const tag = `${at} (${ev.code})`;
    for (const k of ["name", "category", "teamSize", "summary"])
      if (!isStr(ev[k])) e.push(`${tag}: ${k} missing`);
    if (!CLUSTERS.includes(ev.cluster))
      e.push(`${tag}: cluster must be one of ${CLUSTERS.join(", ")}`);
    if (!(
      ev.exam === null ||
      (typeof ev.exam === "string" && ev.exam in EXAMS)
    ))
      e.push(`${tag}: exam must be an exam slug or null`);
    if (!Array.isArray(ev.components) || ev.components.length === 0)
      e.push(`${tag}: components must be a non-empty list`);
    else if (!ev.components.every((c) => COMPONENTS.includes(c)))
      e.push(`${tag}: unknown component`);
    if (!isOfficialDecaUrl(ev.officialUrl))
      e.push(`${tag}: officialUrl must be an official DECA link (deca.org)`);
    if (!nullOr(ev.guidelinesUrl, isOfficialDecaUrl))
      e.push(`${tag}: guidelinesUrl must be an official DECA link or null`);
    if (!(typeof ev.verifiedAt === "string" && DATE.test(ev.verifiedAt)))
      e.push(`${tag}: verifiedAt must be YYYY-MM-DD`);
    if (!nullOr(ev.notes, (v) => typeof v === "string"))
      e.push(`${tag}: notes must be text or null`);
    if (!nullOr(ev.officialCluster, isStr))
      e.push(`${tag}: officialCluster must be text or null`);
    if (ev.format !== undefined && ev.format !== null) {
      const f = ev.format;
      if (!isObj(f)) e.push(`${tag}: format must be an object or null`);
      else {
        if (!nullOr(f.prepMinutes, (v) => isIntIn(v, 0, 120)))
          e.push(`${tag}: format.prepMinutes must be whole minutes or null`);
        if (!nullOr(f.presentMinutes, (v) => isIntIn(v, 1, 120)))
          e.push(`${tag}: format.presentMinutes must be whole minutes or null`);
        if (!nullOr(f.performanceIndicators, (v) => isIntIn(v, 1, 20)))
          e.push(
            `${tag}: format.performanceIndicators must be a count or null`,
          );
        for (const k of ["judgeAppearance", "scoring"])
          if (!nullOr(f[k], isStr))
            e.push(`${tag}: format.${k} must be text or null`);
        if (!nullOr(f.writtenLimit, (v) => isStr(v) || isIntIn(v, 1, 1000)))
          e.push(`${tag}: format.writtenLimit must be text, a number or null`);
      }
    }
  });
  return e;
}

function checkExam(doc, w) {
  const meta = EXAMS[doc.slug];
  const e = [];
  if (!meta) e.push(`${w}: slug "${doc.slug}" is not a known exam slug`);
  if (meta && doc.cluster !== meta.cluster)
    e.push(`${w}: cluster should be "${meta.cluster}"`);
  for (const k of ["title", "blurb", "disclaimer"])
    if (!isStr(doc[k])) e.push(`${w}: ${k} missing`);
  const { e: se, urls } = checkSourcing(doc, w, doc.questions.length, "exam");
  e.push(...se);

  const idRe = meta ? new RegExp(`^${meta.prefix}-\\d{3,}$`) : null;
  const ids = new Set();
  const stems = new Set();
  doc.questions.forEach((q, i) => {
    const at = `${w} question ${i + 1}`;
    if (!isObj(q)) {
      e.push(`${at}: not an object`);
      return;
    }
    if (!idRe || typeof q.id !== "string" || !idRe.test(q.id))
      e.push(`${at}: id must look like ${meta ? meta.prefix : "?"}-001`);
    else if (ids.has(q.id)) e.push(`${at}: duplicate id ${q.id}`);
    else ids.add(q.id);
    const tag = `${at} (${q.id})`;
    if (!isStr(q.area)) e.push(`${tag}: area missing`);
    if (!nullOr(q.pi, (v) => typeof v === "string" && PI_CODE.test(v)))
      e.push(`${tag}: pi must be null or like MK:001`);
    if (!nullOr(q.difficulty, (v) => [1, 2, 3].includes(v)))
      e.push(`${tag}: difficulty must be 1, 2, 3 or null`);
    if (!isStr(q.stem) || q.stem.trim().length < 10)
      e.push(`${tag}: stem too short or missing`);
    else if (stems.has(norm(q.stem))) e.push(`${tag}: duplicate stem`);
    else stems.add(norm(q.stem));
    if (
      !Array.isArray(q.choices) ||
      q.choices.length !== 4 ||
      !q.choices.every(isStr)
    )
      e.push(`${tag}: needs exactly 4 non-empty choices`);
    else if (new Set(q.choices.map(norm)).size !== 4)
      e.push(`${tag}: choices must be distinct`);
    if (!isIntIn(q.answer, 0, 3)) e.push(`${tag}: answer must be an index 0-3`);
    if (!nullOr(q.explanation, (v) => isStr(v) && v.trim().length >= 10))
      e.push(`${tag}: explanation must be null or at least 10 characters`);
    e.push(...checkItemSource(q, tag, urls));
  });
  return e;
}

function checkVocab(doc, w) {
  const e = [];
  if (!(typeof doc.slug === "string" && doc.slug in EXAMS))
    e.push(`${w}: slug must be an exam slug`);
  if (!isStr(doc.title)) e.push(`${w}: title missing`);
  const { e: se, urls } = checkSourcing(doc, w, doc.terms.length, "vocab deck");
  e.push(...se);
  const ids = new Set();
  const terms = new Set();
  doc.terms.forEach((t, i) => {
    const at = `${w} term ${i + 1}`;
    if (!isObj(t)) {
      e.push(`${at}: not an object`);
      return;
    }
    if (typeof t.id !== "string" || !VOCAB_ID.test(t.id))
      e.push(`${at}: id must look like mkt-v-001`);
    else if (ids.has(t.id)) e.push(`${at}: duplicate id ${t.id}`);
    else ids.add(t.id);
    const tag = `${at} (${t.id})`;
    if (!isStr(t.term)) e.push(`${tag}: term missing`);
    else if (terms.has(norm(t.term)))
      e.push(`${tag}: duplicate term ${t.term}`);
    else terms.add(norm(t.term));
    if (!isStr(t.definition) || t.definition.trim().length < 10)
      e.push(`${tag}: definition too short or missing`);
    if (!isStr(t.area)) e.push(`${tag}: area missing`);
    e.push(...checkItemSource(t, tag, urls));
  });
  return e;
}

function checkRoleplay(doc, w) {
  const e = [];
  if (!CLUSTERS.includes(doc.cluster))
    e.push(`${w}: cluster must be one of ${CLUSTERS.join(", ")}`);
  if (!STATUSES.includes(doc.status))
    e.push(`${w}: status must be "sourced" or "placeholder"`);
  const codes = new Set();
  doc.events.forEach((ev, i) => {
    const at = `${w} event ${i + 1}`;
    if (!isObj(ev)) {
      e.push(`${at}: not an object`);
      return;
    }
    if (!isStr(ev.eventCode) || !EVENT_CODE.test(ev.eventCode))
      e.push(`${at}: eventCode must be an event code like PMK`);
    else if (codes.has(ev.eventCode))
      e.push(`${at}: duplicate event ${ev.eventCode}`);
    else codes.add(ev.eventCode);
    const tag = `${at} (${ev.eventCode})`;
    if (!isStr(ev.eventName)) e.push(`${tag}: eventName missing`);
    // Links only. Copied scenario text has no place here (DECA+ terms forbid posting it).
    for (const k of [
      "situation",
      "scenario",
      "text",
      "judgeQuestions",
      "rubricNotes",
    ])
      if (k in ev)
        e.push(`${tag}: ${k} is not allowed; role-play files hold links only`);
    if (!Array.isArray(ev.officialSamples))
      e.push(`${tag}: officialSamples must be a list`);
    else
      ev.officialSamples.forEach((s, j) => {
        const st = `${tag} officialSamples[${j}]`;
        if (!isObj(s)) return e.push(`${st}: not an object`);
        if (!isStr(s.title)) e.push(`${st}: title missing`);
        if (!isOfficialDecaUrl(s.url))
          e.push(`${st}: url must be an official DECA link`);
        if (!nullOr(s.season, isStr))
          e.push(`${st}: season must be text or null`);
      });
    const f = ev.format;
    if (!isObj(f)) e.push(`${tag}: format missing`);
    else {
      if (!nullOr(f.prepMinutes, (v) => isIntIn(v, 0, 120)))
        e.push(`${tag}: format.prepMinutes must be whole minutes or null`);
      if (!nullOr(f.presentationMinutes, (v) => isIntIn(v, 1, 120)))
        e.push(
          `${tag}: format.presentationMinutes must be whole minutes or null`,
        );
      if (!nullOr(f.judgeRole, isStr))
        e.push(`${tag}: format.judgeRole must be text or null`);
    }
    if (typeof ev.placeholder !== "boolean")
      e.push(`${tag}: placeholder must be true or false`);
    if (!nullOr(ev.note, isStr)) e.push(`${tag}: note must be text or null`);
  });
  return e;
}

function checkOfficialSamples(doc, w) {
  const e = [];
  // Shape is free-form; the rule is "links only, and only DECA's own". Every url anywhere must be official.
  const walk = (v, at) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${at}[${i}]`));
    else if (isObj(v))
      for (const [k, x] of Object.entries(v)) {
        if (
          ["questions", "choices", "answer", "situation", "scenario"].includes(
            k,
          )
        )
          e.push(
            `${w}: ${at}.${k} is not allowed; official-samples.json holds links only`,
          );
        else if (k === "url" && !isOfficialDecaUrl(x))
          e.push(`${w}: ${at}.url must be an official DECA link`);
        else walk(x, `${at}.${k}`);
      }
  };
  walk(doc, "$");
  return e;
}

/**
 * The content kind of a file: from its path inside content/ when known (exams/, vocab/, roleplays/, events.json,
 * official-samples.json), else from its shape. Role-play files and events.json both hold an `events` list.
 */
export function kindOf(doc, path = "") {
  const p = String(path).replace(/\\/g, "/");
  const name = p.split("/").pop();
  if (name === "events.json") return "events";
  if (name === "official-samples.json") return "official-samples";
  if (/(^|\/)exams\//.test(p)) return "exam";
  if (/(^|\/)vocab\//.test(p)) return "vocab";
  if (/(^|\/)roleplays\//.test(p)) return "roleplay";
  if (!isObj(doc)) return null;
  if (Array.isArray(doc.questions)) return "exam";
  if (Array.isArray(doc.terms)) return "vocab";
  if (Array.isArray(doc.events))
    return isStr(doc.cluster) ? "roleplay" : "events";
  return null;
}

const LIST_FIELD = {
  events: "events",
  exam: "questions",
  vocab: "terms",
  roleplay: "events",
};
const CHECKS = {
  events: checkEvents,
  exam: checkExam,
  vocab: checkVocab,
  roleplay: checkRoleplay,
  "official-samples": checkOfficialSamples,
};

/** { kind, errors } for one parsed document. `path` (relative to content/) decides the kind when it can. */
export function validateDocument(doc, path = "file") {
  if (!isObj(doc))
    return { kind: null, errors: [`${path}: not a JSON object`] };
  const kind = kindOf(doc, path);
  if (!kind)
    return {
      kind: null,
      errors: [
        `${path}: unknown content type (put it in exams/, vocab/ or roleplays/, or name it events.json)`,
      ],
    };
  const list = LIST_FIELD[kind];
  if (list && !Array.isArray(doc[list]))
    return { kind, errors: [`${path}: ${list} must be a list`] };
  return { kind, errors: CHECKS[kind](doc, path) };
}

const isArchived = (path) =>
  /(^|\/)_archive/.test(String(path).replace(/\\/g, "/"));

/**
 * Validates a whole content folder: every file, file names, ids unique across files, role-play event codes against
 * events.json, and the archive guard. `entries` come from loadCorpus() (check.mjs) or any { path, doc } list.
 */
export function validateCorpus(entries) {
  const errors = [];
  const ids = new Map();
  const events = new Map();
  let hasEvents = false;
  const roleplays = [];
  for (const { path, doc, parseError } of entries) {
    if (isArchived(path)) {
      errors.push(
        `${path}: archived AI-written drafts must never ship; move them out of content/`,
      );
      continue;
    }
    if (parseError) {
      errors.push(`${path}: invalid JSON (${parseError})`);
      continue;
    }
    const { kind, errors: errs } = validateDocument(doc, path);
    errors.push(...errs);
    if (
      errs.length &&
      kind &&
      LIST_FIELD[kind] &&
      !Array.isArray(doc[LIST_FIELD[kind]])
    )
      continue;
    const base = String(path)
      .split("/")
      .pop()
      .replace(/\.json$/, "");
    if (kind === "events") {
      hasEvents = true;
      for (const ev of doc.events)
        if (isObj(ev) && isStr(ev.code)) events.set(ev.code, ev);
    }
    if ((kind === "exam" || kind === "vocab") && base !== doc.slug)
      errors.push(`${path}: file name must match slug "${doc.slug}"`);
    if (kind === "roleplay") {
      if (base !== doc.cluster)
        errors.push(`${path}: file name must match cluster "${doc.cluster}"`);
      roleplays.push({ path, doc });
    }
    const items =
      kind === "exam" ? doc.questions : kind === "vocab" ? doc.terms : [];
    for (const item of items) {
      if (!isObj(item) || typeof item.id !== "string") continue;
      if (ids.has(item.id))
        errors.push(
          `${path}: id ${item.id} already used in ${ids.get(item.id)}`,
        );
      else ids.set(item.id, path);
    }
  }
  for (const { path, doc } of roleplays)
    for (const ev of doc.events) {
      if (!isObj(ev) || !isStr(ev.eventCode)) continue;
      if (!hasEvents) {
        errors.push(
          `${path}: ${ev.eventCode} needs an events.json to check against`,
        );
        continue;
      }
      const known = events.get(ev.eventCode);
      if (!known) {
        errors.push(`${path}: ${ev.eventCode} is not in events.json`);
        continue;
      }
      const f = isObj(ev.format) ? ev.format : {};
      const k = isObj(known.format) ? known.format : {};
      if (
        Number.isInteger(f.prepMinutes) &&
        Number.isInteger(k.prepMinutes) &&
        f.prepMinutes !== k.prepMinutes
      )
        errors.push(
          `${path}: ${ev.eventCode} prepMinutes ${f.prepMinutes} differs from events.json (${k.prepMinutes})`,
        );
      if (
        Number.isInteger(f.presentationMinutes) &&
        Number.isInteger(k.presentMinutes) &&
        f.presentationMinutes !== k.presentMinutes
      )
        errors.push(
          `${path}: ${ev.eventCode} presentationMinutes ${f.presentationMinutes} differs from events.json (${k.presentMinutes})`,
        );
    }
  return errors;
}

/**
 * Advice that does not block a build. Sourced banks keep their source's choice order (SCHEMA.md addendum), so an
 * uneven answer spread is reported, not refused.
 */
export function auditCorpus(entries) {
  const warnings = [];
  for (const { path, doc, parseError } of entries) {
    if (
      parseError ||
      isArchived(path) ||
      kindOf(doc, path) !== "exam" ||
      !Array.isArray(doc?.questions)
    )
      continue;
    const dist = [0, 0, 0, 0];
    for (const q of doc.questions)
      if (isObj(q) && isIntIn(q.answer, 0, 3)) dist[q.answer]++;
    const n = dist.reduce((a, b) => a + b, 0);
    if (n < 20) continue;
    dist.forEach((k, i) => {
      if (k < 0.15 * n || k > 0.35 * n)
        warnings.push(
          `${path}: answer ${"ABCD"[i]} is keyed ${k} of ${n} times (about 25% is typical)`,
        );
    });
  }
  return warnings;
}
