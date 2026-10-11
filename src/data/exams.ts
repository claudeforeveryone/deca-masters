import type { ExamId } from './events'
import type { Question } from './questions'
import INDEX from './examIndex.json'

// Past DECA exam booklets, one file each in public/exams/<id>.json, built by
// scripts/build-exams.mjs. The index below is small and bundled; the questions are
// fetched when someone opens an exam.
export type ExamLevel = 'ICDC' | 'State' | 'Provincial' | 'Regional' | 'District' | 'Sample' | 'Exemplar' | 'Practice' | 'Collegiate' | 'Challenge'

export type PastExam = {
  id: string
  cluster: ExamId
  year: number | null
  level: ExamLevel
  test: string | null // DECA test number, e.g. "1088"
  count: number
  explained: number // questions that come with an explanation
}

export const PAST_EXAMS = INDEX as PastExam[]

/** How each level reads on the page, and the order levels are listed in within a year. */
export const LEVELS: Record<ExamLevel, { label: string; blurb: string }> = {
  ICDC: { label: 'ICDC', blurb: 'International Career Development Conference' },
  State: { label: 'State', blurb: 'State / association conference' },
  Provincial: { label: 'Provincial', blurb: 'Provincial / association conference' },
  Regional: { label: 'Regional', blurb: 'Regional conference' },
  District: { label: 'District', blurb: 'District conference' },
  Sample: { label: 'Sample', blurb: 'Official DECA sample exam' },
  Exemplar: { label: 'Exemplar', blurb: 'Official DECA exemplar exam' },
  Practice: { label: 'Practice', blurb: 'Past DECA test booklet' },
  Collegiate: { label: 'DECA U', blurb: 'Collegiate DECA exam' },
  Challenge: { label: 'Challenge', blurb: 'Hand-picked difficult questions' },
}
export const LEVEL_ORDER = Object.keys(LEVELS) as ExamLevel[]

/** Filter groups shown above the list. Conference levels are grouped the way students talk about them. */
export const LEVEL_FILTERS: { key: string; label: string; levels: ExamLevel[] }[] = [
  { key: 'all', label: 'All', levels: LEVEL_ORDER },
  { key: 'icdc', label: 'ICDC', levels: ['ICDC'] },
  { key: 'state', label: 'State / Provincial', levels: ['State', 'Provincial'] },
  { key: 'regional', label: 'Regional / District', levels: ['Regional', 'District'] },
  { key: 'sample', label: 'Sample', levels: ['Sample', 'Exemplar'] },
  { key: 'other', label: 'Other', levels: ['Practice', 'Collegiate', 'Challenge'] },
]

export const examById = (id: string) => PAST_EXAMS.find((x) => x.id === id)

/** "2019 ICDC", or "Test 1027" for numbered booklets with no year. */
export const examTitle = (x: PastExam) => (x.year ? `${x.year} ${LEVELS[x.level].label}` : x.test ? `Test ${x.test}` : LEVELS[x.level].label)

const cache = new Map<string, Promise<Question[]>>()

export function loadExam(x: PastExam): Promise<Question[]> {
  let p = cache.get(x.id)
  if (!p) {
    p = fetch(`/exams/${x.id}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load this exam (${r.status})`)
        return r.json() as Promise<Omit<Question, 'exam'>[]>
      })
      .then((rows) => rows.map((q) => ({ ...q, exam: x.cluster })))
    p.catch(() => cache.delete(x.id))
    cache.set(x.id, p)
  }
  return p
}
