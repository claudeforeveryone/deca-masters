// Builds public/questions/<exam>.json and src/data/questionCounts.json from the source question banks.
//   node scripts/build-questions.mjs <source dir> <mkt text from `pdftotext MKT-all-questions.pdf`>
// The source dir holds core.json, bma.json, ent.json, fin.json and ht.json, each
// { "<exam set>": [{ number, question, choices: ["A. ..."], answer: "A", reasoning }] }.
import fs from 'node:fs'
import path from 'node:path'

const [srcDir, mktText] = process.argv.slice(2)
const outDir = path.resolve('public/questions')

// DECA instructional area codes, as cited in each explanation ("SOURCE: BL:068").
const AREAS = {
  BL: 'Business Law', CO: 'Communication Skills', CR: 'Customer Relations', EC: 'Economics', EI: 'Emotional Intelligence',
  FI: 'Financial Analysis', HR: 'Human Resources Management', NF: 'Information Management', MK: 'Marketing', OP: 'Operations',
  PD: 'Professional Development', SM: 'Strategic Management', CM: 'Channel Management', MP: 'Market Planning',
  IM: 'Marketing-Information Management', PI: 'Pricing', PM: 'Product/Service Management', PR: 'Promotion', SE: 'Selling',
  EN: 'Entrepreneurship', FM: 'Financial-Information Management', RM: 'Risk Management', KM: 'Knowledge Management',
  QM: 'Quality Management', ST: 'Strategic Management', BM: 'Business Management', AC: 'Accounting', CC: 'Career Development',
  PJ: 'Project Management', HT: 'Hospitality and Tourism', FN: 'Finance', MN: 'Management',
  // Older codes used in pre-2015 booklets.
  BA: 'Business Management', DS: 'Channel Management', IS: 'Emotional Intelligence',
}
const unknownAreas = new Map()

const clean = (s) => s.replace(/\s+/g, ' ').replace(/\uFFFD/g, '–').trim()
const norm = (s) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, '')
const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0).toString(36)
}

/** Splits an explanation into the readable part and its instructional area. */
function explain(raw) {
  let text = clean(raw).replace(/^\(/, '').replace(/\)$/, '')
  text = text.replace(/\s*NOTES ORDERING INFORMATION[\s\S]*$/, '')
  const m = text.match(/SOURCE:\s*([A-Z]{2,3}):\d+/)
  let area = 'General'
  if (m) {
    area = AREAS[m[1]] ?? m[1]
    if (!AREAS[m[1]]) unknownAreas.set(m[1], (unknownAreas.get(m[1]) ?? 0) + 1)
  }
  const cut = text.search(/\s*SOURCE:/)
  if (cut > 0) text = text.slice(0, cut)
  return { explanation: text.trim(), area }
}

function fromJson(file) {
  const data = JSON.parse(fs.readFileSync(path.join(srcDir, file), 'utf8'))
  const out = []
  for (const [set, qs] of Object.entries(data))
    for (const q of qs) {
      const choices = q.choices.map((c) => clean(c).replace(/^[A-D]\.\s*/, ''))
      // A few booklets lose the first letter of question 1 ("hich of the following...").
      const prompt = clean(q.question).replace(/^(hich|hat|he|n) /, (m, w) => ({ hich: 'Which', hat: 'What', he: 'The', n: 'In' })[w] + ' ')
      out.push({ set, prompt, choices, answer: 'ABCD'.indexOf(q.answer), ...explain(q.reasoning ?? '') })
    }
  return out
}

/** The marketing bank only exists as a PDF; parse its text dump. */
function fromMktText(file) {
  const text = fs.readFileSync(file, 'utf8')
    .replace(/\r/g, '')
    .replace(/^\d+\s*$/gm, '') // page numbers
    .replace(/\f/g, '\n')
  const out = []
  const misses = []
  let pos = 0
  for (let n = 1; ; n++) {
    const start = text.slice(pos).search(new RegExp(`(^|\\s)${n}\\. `, 'm'))
    if (start < 0) break
    const from = pos + start
    const exp = text.indexOf('Explanation:', from)
    if (exp < 0) break
    const next = text.slice(exp).search(new RegExp(`(^|\\s)${n + 1}\\. \\S`, 'm'))
    const end = next < 0 ? text.length : exp + next
    const head = clean(text.slice(from, exp)).replace(new RegExp(`^${n}\\.\\s*`), '')
    const m = head.match(/^(.*?)(?:^|\s)A\.\s+(.*?)\s+B\.\s+(.*?)\s+C\.\s+(.*?)\s+D\.\s+(.*)$/)
    pos = end
    if (!m) { misses.push(`${n}: no choices`); continue }
    const [, prompt, ...choices] = m
    const ex = explain(text.slice(exp + 'Explanation:'.length, end))
    // The explanation opens with the correct choice, e.g. "(Contract. Contracts are..."
    const lead = norm(ex.explanation.slice(0, 200))
    const scores = choices.map((c) => {
      const k = norm(c)
      return lead.startsWith(k) ? k.length + 1000 : commonPrefix(lead, k)
    })
    const best = scores.indexOf(Math.max(...scores))
    if (scores[best] < 1000) misses.push(`${n}: fuzzy answer (${scores.join(',')}) ${choices[best]} | ${ex.explanation.slice(0, 60)}`)
    if (scores[best] < 4) { misses.push(`${n}: dropped`); continue }
    out.push({ set: 'MKT', prompt: clean(prompt), choices: choices.map((c) => clean(c)), answer: best, ...ex })
  }
  return { out, misses }
}
const commonPrefix = (a, b) => { let i = 0; while (i < a.length && a[i] === b[i]) i++; return i }

function write(exam, rows) {
  const seen = new Set()
  const qs = []
  let bad = 0
  for (const r of rows) {
    if (r.answer < 0 || r.choices.length !== 4 || !r.prompt || r.choices.some((c) => !c)) { bad++; continue }
    const key = norm(r.prompt) + '|' + r.choices.map(norm).sort().join('|')
    if (seen.has(key)) continue
    seen.add(key)
    qs.push({ id: `${exam}-${hash(key)}`, area: r.area, prompt: r.prompt, choices: r.choices, answer: r.answer, explanation: r.explanation, set: r.set })
  }
  const ids = new Set(qs.map((q) => q.id))
  if (ids.size !== qs.length) throw new Error(`${exam}: id collision`)
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `${exam}.json`), JSON.stringify(qs))
  console.log(`${exam}: ${rows.length} source, ${qs.length} unique, ${bad} skipped`)
  return qs.length
}

const counts = {
  bac: write('bac', fromJson('core.json')),
  bma: write('bma', fromJson('bma.json')),
  ent: write('ent', fromJson('ent.json')),
  fin: write('fin', fromJson('fin.json')),
  ht: write('ht', fromJson('ht.json')),
}
const mkt = fromMktText(mktText)
counts.mkt = write('mkt', mkt.out)
// Keep the pfl count, which scripts/build-exams.mjs adds.
const prevCounts = fs.existsSync('src/data/questionCounts.json') ? JSON.parse(fs.readFileSync('src/data/questionCounts.json', 'utf8')) : {}
fs.writeFileSync('src/data/questionCounts.json', JSON.stringify({ ...prevCounts, ...counts }) + '\n')
console.log('mkt parse issues:', mkt.misses.length)
console.log(mkt.misses.slice(0, 40).join('\n'))
console.log('unknown area codes:', [...unknownAreas].join(' '))
