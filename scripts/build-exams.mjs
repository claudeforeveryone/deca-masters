// Builds the past-exam library (public/exams/*.json + src/data/examIndex.json) from a folder
// of DECA exam booklets that were converted to text first:
//   PDFs  -> pdftotext <file> <file>.txt
//   Word  -> Word "Save as plain text" (UTF-8) to <file>.txt
//   .xls answer keys -> one tab-separated file per sheet, <file>.sheetN.tsv
//   node scripts/build-exams.mjs <text dir> [--sets <dir with core.json, bma.json, ...>] [--verbose]
// The text dir mirrors the source layout: <Cluster folder>/<year>/<file>.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const root = process.argv[2]
const outDir = path.resolve('public/exams')
const verbose = process.argv.includes('--verbose')

const CLUSTERS = [
  [/^Business Management/i, 'bma'],
  [/^Entrepreneurship/i, 'ent'],
  [/^Finance/i, 'fin'],
  [/^Hospitality/i, 'ht'],
  [/^Marketing/i, 'mkt'],
  [/^Personal Financial/i, 'pfl'],
  [/^Principles/i, 'bac'],
]

/** Competition level from a file name or booklet header, or null if it doesn't say. */
function levelIn(t) {
  if (/icdc|international career/i.test(t)) return 'ICDC'
  if (/exemplar/i.test(t)) return 'Exemplar'
  if (/sample/i.test(t)) return 'Sample'
  if (/state/i.test(t)) return 'State'
  if (/provincial|association/i.test(t)) return 'Provincial'
  if (/regional/i.test(t)) return 'Regional'
  if (/district/i.test(t)) return 'District'
  if (/universit|collegiate|deca u/i.test(t)) return 'Collegiate'
  return null
}

const clean = (s) => s.replace(/\s+/g, ' ').replace(/�/g, '–').replace(/ /g, ' ').trim()
const norm = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '')
const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

// Page furniture that shows up between questions in every booklet format.
const JUNK = [
  /^\s*test\s*(number\s*)?\d{3,4}\b.*$/i,
  /^.*copyright\s*(©|\(c\)|\d{4}|information|violation).*$/i,
  /^\s*\d{1,3}\s*$/,
  /^.*\b(cluster|core|series|management|marketing|finance|hospitality|entrepreneurship|literacy)\s+(career\s+)?(cluster\s+)?exam\s*(—|-|–)?\s*(key)?\s*\d*\s*$/i,
  /^.*DECA (Ontario|Inc).*(Provincials|Regionals|Answer Key).*$/i,
  /^\s*(caution|instructions|this comprehensive exam|these test questions|items have been|dba mbaresearch|each individual|deca inc\. will impose).*$/i,
  /^\s*booklet number.*$/i,
  /^\s*competency-based competitive events.*$/i,
  /^\s*\*?written exam\*?.*$/i,
]
const stripJunk = (text) => text.replace(/\r/g, '').replace(/\f/g, '\n').split('\n').filter((l) => l.length > 200 || !JUNK.some((re) => re.test(l))).join('\n')

const reEsc = (n) => String(n)
const qStart = (n) => new RegExp(`(^|\\s)${reEsc(n)}\\s*[.)]\\s+(?=\\S)`, 'm')
const keyEntry = (n) => new RegExp(`(^|\\s)${reEsc(n)}\\s*[.)]?\\s+([A-D])(?=[\\s.)]|$)`, 'm')

/** Finds where the answer key starts: the "1. X" position that begins the longest run of "n. X" entries. */
function findKey(text, minRun = 20) {
  const re = /(^|\s)1\s*[.)]?\s+([A-D])(?=[\s.)]|$)/gm
  let best = null
  for (let m; (m = re.exec(text)); ) {
    const start = m.index
    const answers = readKey(text.slice(start))
    const run = Object.keys(answers.letters).length
    if (run >= minRun && (!best || run > best.run || (run === best.run && start > best.start))) best = { start, run, ...answers }
  }
  return best
}

/** Reads "n. X explanation" entries. Handles keys laid out in columns (1 B 51 C / 2 D 52 A). */
function readKey(text) {
  const letters = {}
  const explanations = {}
  let pos = 0
  let misses = 0
  for (let n = 1; n <= 200 && misses < 3; n++) {
    const fwd = text.slice(pos).search(keyEntry(n))
    let at = fwd >= 0 && fwd < 6000 ? pos + fwd : -1
    if (at < 0) {
      const any = text.search(keyEntry(n))
      if (any < 0) { misses++; continue }
      at = any
    }
    misses = 0
    const m = text.slice(at).match(keyEntry(n))
    letters[n] = m[2]
    const after = at + m[0].length
    const next = text.slice(after).search(keyEntry(n + 1))
    const body = next < 0 ? text.slice(after, after + 1500) : text.slice(after, after + next)
    const ex = clean(body.split(/SOURCE:/)[0])
    if (ex.length > 15 && !/^\d+\s*[.)]?\s*[A-D]\b/.test(ex)) explanations[n] = ex
    pos = after
  }
  return { letters, explanations }
}

/** Cleans a prompt or choice, dropping page-footer text a PDF glued onto its end. */
const tidy = (s) => clean(s).replace(/s*(Test d{3,4}.*|®s*,?s*Columbus.*|ST-MKTG?.*|[A-Z ]{6,}CLUSTER EXAM.*)$/, '')

/** Splits a question block into its prompt and four choices (choices may be laid out A C / B D). */
function splitChoices(block) {
  const marks = [...block.matchAll(/(?:^|\s)([A-D])\s*[.)]\s+/g)].map((m) => ({ letter: m[1], at: m.index, end: m.index + m[0].length }))
  for (const a of marks.filter((m) => m.letter === 'A')) {
    const after = marks.filter((m) => m.at > a.at)
    const pick = { A: a }
    for (const L of ['B', 'C', 'D']) pick[L] = after.find((m) => m.letter === L)
    if (!pick.B || !pick.C || !pick.D) continue
    const chosen = Object.values(pick).sort((x, y) => x.at - y.at)
    const choices = {}
    chosen.forEach((m, k) => { choices[m.letter] = clean(block.slice(m.end, k + 1 < chosen.length ? chosen[k + 1].at : block.length)) })
    if (Object.values(choices).some((c) => !c || c.length > 400)) continue
    return { prompt: tidy(block.slice(0, a.at)), choices: ['A', 'B', 'C', 'D'].map((L) => tidy(choices[L])) }
  }
  return null
}

function readQuestions(text) {
  const out = []
  let pos = 0
  for (let n = 1; n <= 200; n++) {
    const s = text.slice(pos).search(qStart(n))
    if (s < 0 || (n > 1 && s > 8000)) break
    const from = pos + s
    const head = text.slice(from).match(qStart(n))[0]
    const nx = text.slice(from + head.length).search(qStart(n + 1))
    const end = nx < 0 ? text.length : from + head.length + nx
    const parsed = splitChoices(text.slice(from + head.length, end))
    if (parsed && parsed.prompt) out.push({ n, ...parsed })
    pos = from + head.length
  }
  return out
}

/** The answer from an explanation that opens with the correct choice ("Contract. Contracts are..."). */
function answerFromExplanation(ex, choices) {
  if (!ex) return -1
  const lead = norm(ex.slice(0, 250))
  const hits = choices.map((c, i) => [i, norm(c)]).filter(([, c]) => c.length > 2 && lead.startsWith(c))
  return hits.length === 1 ? hits[0][0] : -1
}

// ---------- Booklets exported with a broken font ----------
// A few ICDC booklets come out with every character shifted down 29 code points
// ("+6 ,&'&" is "HS ICDC") and with the question numbers and periods dropped.
function unshift(text) {
  const plain = (text.match(/\b(the|of|and|to)\b/g) || []).length
  const shifted = (text.match(/\b(WKH|RI|DQG|WR)\b/g) || []).length
  return shifted > plain * 2 ? text.replace(/[!-\]]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 29)) : null
}

/** Puts numbers back on an unshifted booklet: choices are "A  text" at the start of a line, prompts are indented. */
function renumber(text) {
  const lines = text.replace(/\r/g, '').split('\n')
  const keyAt = lines.findIndex((l) => /EXAM\W{0,3}KEY/i.test(l))
  const out = []
  let n = 0
  let afterD = true
  for (const line of keyAt > 0 ? lines.slice(0, keyAt) : lines) {
    const choice = line.match(/^([A-D])\s{2,}(.*)$/)
    if (choice) {
      out.push(`${choice[1]}. ${choice[2]}`)
      if (choice[1] === 'D') afterD = true
      continue
    }
    if (!line.trim() || /CLUSTER EXAM|HS ICDC|^\s*\d+\s*$/i.test(line)) continue // blank lines and page headers
    // A choice can also trail the prompt line: "...ultimate consumer or when A  changes are made".
    const body = line.trim().replace(/\s([A-D])\s{2,}/g, ' $1. ')
    out.push(afterD ? `${++n}. ${body}` : body)
    afterD = false
  }
  if (keyAt > 0) {
    out.push('KEY')
    let k = 0
    for (const line of lines.slice(keyAt + 1)) {
      const letter = line.match(/^\s+([A-D])\s*$/)
      if (letter) out.push(`${++k}. ${letter[1]}`)
      else if (k && line.trim()) out.push(line.trim())
    }
  }
  return out.join('\n')
}

// ---------- Answer keys from the .xls key spreadsheets (several tests side by side, by test number) ----------
function readSheetKeys(file) {
  const rows = fs.readFileSync(file, 'utf8').split(/\r?\n/).map((r) => r.split('\t'))
  const keys = {}
  rows.forEach((row, r) => {
    row.forEach((cell, c) => {
      if (!/^\d{3,4}(\.0)?$/.test(cell.trim())) return
      const num = String(parseInt(cell, 10))
      const base = c - 4
      if (base < 0) return
      const letters = {}
      for (const data of rows.slice(r + 1)) {
        for (const off of [0, 3]) {
          const n = parseInt(data[base + off], 10)
          const L = (data[base + off + 1] || '').trim().toUpperCase()
          if (n && /^[A-D]$/.test(L)) letters[n] = L
        }
      }
      if (Object.keys(letters).length >= 20) keys[num] = { letters, explanations: {} }
    })
  })
  return keys
}

// ---------- The site's question bank: DECA reuses items, so it fills in missing keys, explanations and areas ----------
const bank = new Map()
for (const f of fs.existsSync('public/questions') ? fs.readdirSync('public/questions') : []) {
  for (const q of JSON.parse(fs.readFileSync(path.join('public/questions', f), 'utf8'))) {
    const k = norm(q.prompt)
    if (k.length > 15 && !bank.has(k)) bank.set(k, q)
  }
}
/** The bank's copy of a question, if its prompt and choices match. */
function fromBank(prompt, choices) {
  const b = bank.get(norm(prompt))
  if (!b) return null
  const mine = choices.map(norm)
  const right = norm(b.choices[b.answer])
  const answer = mine.indexOf(right)
  if (answer < 0 || b.choices.some((c) => !mine.includes(norm(c)))) return null
  return { answer, explanation: b.explanation, area: b.area }
}

// ---------- Walk the text dir ----------
const files = []
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name))))
walk(root)

const sheetKeys = {}
for (const f of files.filter((f) => f.endsWith('.tsv'))) Object.assign(sheetKeys, readSheetKeys(f))

const isKeyFile = (name) => /(\bkey\b|answers?)/i.test(name) && !/(exam|test)\s*(\+|and|&)\s*key/i.test(name) && !/exam.*key_\d/i.test(name)
/** DECA test number (e.g. 1088), from the file name or the booklet header. Years are not test numbers. */
const testNumber = (name, text) =>
  [...name.matchAll(/(?:^|[^\d])(\d{3,4})[A-Z]?(?![\d])/g)].map((m) => m[1]).find((n) => !/^(19|20)\d\d$/.test(n)) ??
  text.match(/Test\s*(?:Number\s*)?(\d{3,4})/i)?.[1] ??
  null

const exams = []
const report = []
for (const file of files.filter((f) => f.endsWith('.txt'))) {
  const rel = path.relative(root, file).split(path.sep)
  const name = rel[rel.length - 1].replace(/\.(pdf|docx?|rtf)\.txt$/i, '')
  if (isKeyFile(name)) continue
  const top = rel[0]
  let cluster = CLUSTERS.find(([re]) => re.test(top))?.[1]
  let year = /^\d{4}$/.test(rel[1]) ? Number(rel[1]) : null
  let level
  let raw = fs.readFileSync(file, 'utf8').replace(/^﻿/, '')
  const decoded = unshift(raw)
  if (decoded) raw = renumber(decoded)
  if (/^DECA U/i.test(top)) {
    cluster = /hospitality|travel/i.test(name) ? 'ht' : /financ|09 FSMM|09 FMM/i.test(name) ? 'fin' : /restaurant|RFSM/i.test(name) ? 'ht' : 'mkt'
    level = 'Collegiate'
  } else if (/^Difficult/i.test(top)) {
    cluster = /hospitality/i.test(name) ? 'ht' : /principles/i.test(name) ? 'bac' : 'mkt'
    level = 'Challenge'
  }
  if (!cluster) continue
  const text = stripJunk(raw)
  const named = levelIn(name)
  level ??= named ?? levelIn(raw.slice(0, 1500)) ?? 'Practice'
  const num = testNumber(name, raw)

  // Questions come before the key when both are in one file.
  let key = findKey(text)
  const qText = key ? text.slice(0, key.start) : text
  let questions = readQuestions(qText)
  if (questions.length < 20) questions = readQuestions(text)

  // Separate key file in the same folder, or an .xls key by test number.
  let keySource = key ? 'inline' : null
  if (!key || key.run < questions.length * 0.8) {
    const dir = path.dirname(file)
    const siblings = fs.readdirSync(dir).filter((f) => f.endsWith('.txt') && isKeyFile(f.replace(/\.(pdf|docx?|rtf)\.txt$/i, '')))
    const match = siblings.find((f) => num && f.includes(num)) ?? (siblings.length === 1 ? siblings[0] : siblings.find((f) => f.toLowerCase().includes(level.toLowerCase().slice(0, 6))))
    if (match) {
      const k = findKey(stripJunk(fs.readFileSync(path.join(dir, match), 'utf8')), 10)
      if (k && (!key || k.run > key.run)) { key = k; keySource = match }
    }
    if ((!key || key.run < questions.length * 0.8) && num && sheetKeys[num]) { key = { ...sheetKeys[num], run: Object.keys(sheetKeys[num].letters).length }; keySource = 'xls' }
  }

  const rows = []
  let disagree = 0
  let banked = 0
  for (const q of questions) {
    const b = fromBank(q.prompt, q.choices)
    const ex = key?.explanations?.[q.n] || b?.explanation || ''
    const fromKey = key?.letters?.[q.n] ? 'ABCD'.indexOf(key.letters[q.n]) : -1
    const fromEx = answerFromExplanation(ex, q.choices)
    if (fromKey >= 0 && fromEx >= 0 && fromKey !== fromEx) disagree++
    let answer = fromEx >= 0 ? fromEx : fromKey
    if (answer < 0 && b) { answer = b.answer; banked++ }
    if (answer < 0) continue
    rows.push({ n: q.n, prompt: q.prompt, choices: q.choices, answer, explanation: ex, area: b?.area ?? 'General' })
  }
  // A booklet without its key is kept when the bank recovers enough of it to be a real test.
  const keyless = !key || key.run < questions.length * 0.5
  // Check the key against the bank. A booklet whose key is misaligned disagrees on many shared questions:
  // if most of it is in the bank, use the bank's answers; otherwise drop it.
  const shared = rows.map((r) => ({ r, b: fromBank(r.prompt, r.choices) })).filter((x) => x.b)
  const off = shared.filter((x) => x.b.answer !== x.r.answer).length
  let rowsOk = true
  if (shared.length >= 10 && off > shared.length * 0.1) {
    if (shared.length >= rows.length * 0.8) {
      rows.splice(0, rows.length, ...shared.map(({ r, b }) => ({ ...r, answer: b.answer, explanation: b.explanation || r.explanation })))
    } else rowsOk = false
  }
  const ok = rowsOk && rows.length >= (keyless ? 40 : 20) && disagree <= rows.length * 0.1
  report.push({ file: rel.join('/'), cluster, year, level, num, questions: questions.length, answered: rows.length, banked, keySource, disagree, ok })
  if (ok) exams.push({ cluster, year, level, levelFromName: !!named, num, name, file: rel.join('/'), rows })
}

// ---------- Numbered DECA sets from the extracted JSON banks (e.g. "1031-BMA", "2018-ENT-ICDC") ----------
const setsDir = process.argv[process.argv.indexOf('--sets') + 1]
if (process.argv.includes('--sets')) {
  const SET_FILES = { 'core.json': 'bac', 'bma.json': 'bma', 'ent.json': 'ent', 'fin.json': 'fin', 'ht.json': 'ht' }
  for (const [file, cluster] of Object.entries(SET_FILES)) {
    const data = JSON.parse(fs.readFileSync(path.join(setsDir, file), 'utf8'))
    for (const [set, qs] of Object.entries(data)) {
      if (/UNIT/.test(set)) continue // a topic unit, not an exam
      const m = set.match(/^(\d{4})-[A-Za-z]+(?:-(.+))?$/)
      const tag = (m?.[2] ?? '').toUpperCase()
      const isYear = /ICDC|SAMPLE/.test(tag) && Number(m[1]) >= 2005 && Number(m[1]) <= 2030
      const rows = qs
        .filter((q) => q.choices?.length === 4 && /^[A-D]$/.test(q.answer))
        .map((q) => {
          const choices = q.choices.map((c) => tidy(c.replace(/^\s*[A-D]\.\s*/, '')))
          const prompt = clean(q.question).replace(/^(hich|hat|he|n) /, (_, w) => ({ hich: 'Which', hat: 'What', he: 'The', n: 'In' })[w] + ' ')
          const b = fromBank(prompt, choices)
          return { prompt, choices, answer: 'ABCD'.indexOf(q.answer), explanation: clean((q.reasoning ?? '').split(/SOURCE:/)[0]), area: b?.area ?? 'General' }
        })
      if (rows.length < 20) continue
      exams.push({
        cluster,
        year: isYear ? Number(m[1]) : null,
        level: /ICDC/.test(tag) ? 'ICDC' : /SAMPLE/.test(tag) ? 'Sample' : 'Practice',
        levelFromName: /ICDC|SAMPLE/.test(tag),
        num: isYear ? null : m?.[1] ?? null,
        name: set,
        file: `${file}#${set}`,
        rows,
      })
    }
  }
}

// ---------- Dedupe: the same booklet often appears as .pdf, .docx and "Copy of ..." ----------
const fingerprint = (e) => e.rows.slice(0, 8).map((r) => norm(r.prompt).slice(0, 40)).join('|')
const byPrint = new Map()
for (const e of exams) {
  const k = `${e.cluster}|${fingerprint(e)}`
  const prev = byPrint.get(k)
  const score = (x) => x.rows.length * 10 + x.rows.filter((r) => r.explanation).length + (x.year ?? 0) / 10000
  const [win, lose] = !prev || score(e) > score(prev) ? [e, prev] : [prev, e]
  // Keep the best copy, but take the year, level and test number from whichever copy knows them.
  if (lose) {
    win.year ??= lose.year
    if (win.level === 'Practice' || (lose.levelFromName && !win.levelFromName)) win.level = lose.level
    win.num ??= lose.num
  }
  byPrint.set(k, win)
}
const unique = [...byPrint.values()]

// ---------- Write ----------
const LEVEL_ORDER = ['ICDC', 'State', 'Provincial', 'Regional', 'District', 'Sample', 'Exemplar', 'Practice', 'Collegiate', 'Challenge']
fs.rmSync(outDir, { recursive: true, force: true })
fs.mkdirSync(outDir, { recursive: true })
const index = []
const usedIds = new Set()
for (const e of unique.sort((a, b) => (b.year ?? 0) - (a.year ?? 0) || LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level))) {
  let id = [e.cluster, e.year ?? 'x', e.level.toLowerCase(), e.num ?? hash(fingerprint(e)).slice(0, 4)].join('-')
  while (usedIds.has(id)) id += 'b'
  usedIds.add(id)
  const questions = e.rows.map((r, i) => ({ id: `${id}-${i + 1}`, area: r.area, prompt: r.prompt, choices: r.choices, answer: r.answer, explanation: r.explanation }))
  fs.writeFileSync(path.join(outDir, `${id}.json`), JSON.stringify(questions))
  index.push({ id, cluster: e.cluster, year: e.year, level: e.level, test: e.num, count: questions.length, explained: questions.filter((q) => q.explanation).length })
}
fs.writeFileSync('src/data/examIndex.json', JSON.stringify(index, null, 0) + '\n')

const bad = report.filter((r) => !r.ok)
console.log(`files parsed: ${report.length}, usable: ${exams.length}, unique exams: ${unique.length}, questions: ${index.reduce((s, x) => s + x.count, 0)}`)
for (const c of ['bac', 'bma', 'ent', 'fin', 'ht', 'mkt', 'pfl']) console.log(` ${c}: ${index.filter((x) => x.cluster === c).length} exams`)
console.log(`skipped ${bad.length}:`)
for (const r of bad) console.log(`  ${r.file} q=${r.questions} a=${r.answered} key=${r.keySource} disagree=${r.disagree}`)
if (verbose) fs.writeFileSync(path.join(os.tmpdir(), 'exam-report.json'), JSON.stringify(report, null, 1))

// ---------- Personal Financial Literacy has no other source, so its practice bank comes from these exams ----------
{
  const seen = new Set()
  const pfl = []
  for (const x of index.filter((e) => e.cluster === 'pfl')) {
    for (const q of JSON.parse(fs.readFileSync(path.join(outDir, `${x.id}.json`), 'utf8'))) {
      const k = norm(q.prompt) + '|' + q.choices.map(norm).sort().join('|')
      if (seen.has(k)) continue
      seen.add(k)
      pfl.push({ ...q, id: `pfl-${hash(k)}`, set: `${x.year ?? ''} ${x.level}`.trim() })
    }
  }
  fs.writeFileSync('public/questions/pfl.json', JSON.stringify(pfl))
  const counts = JSON.parse(fs.readFileSync('src/data/questionCounts.json', 'utf8'))
  counts.pfl = pfl.length
  fs.writeFileSync('src/data/questionCounts.json', JSON.stringify(counts) + '\n')
  console.log(`pfl bank: ${pfl.length} questions`)
}
