import { useEffect, useState } from 'react'
import type { ExamId } from './events'
import COUNTS from './questionCounts.json'
import { PAST_EXAMS, loadExam } from './exams'

// The question banks for each cluster exam live in public/questions/<exam>.json, built from
// past DECA exam booklets by scripts/build-questions.mjs (pfl.json by scripts/build-exams.mjs).
// They are a few MB each, so they are fetched on demand rather than bundled.
export type Question = {
  id: string
  exam: ExamId
  area: string // instructional area
  prompt: string
  choices: string[]
  answer: number
  explanation: string
  set?: string // source exam booklet, e.g. "1031-BMA"
}

const BANKED = ['bac', 'bma', 'ent', 'fin', 'ht', 'mkt', 'pfl'] as const
const hasBank = (exam: string): exam is (typeof BANKED)[number] => (BANKED as readonly string[]).includes(exam)

export const questionCount = (exam: ExamId) => COUNTS[exam]

const cache = new Map<ExamId, Promise<Question[]>>()

export function loadQuestions(exam: ExamId): Promise<Question[]> {
  let p = cache.get(exam)
  if (!p) {
    p = fetch(`/questions/${exam}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`Could not load the ${exam} questions (${r.status})`)
        return r.json() as Promise<Omit<Question, 'exam'>[]>
      })
      .then((rows) => rows.map((x) => ({ ...x, exam })))
    p.catch(() => cache.delete(exam))
    cache.set(exam, p)
  }
  return p
}

/**
 * Loads the questions behind a list of ids. Bank ids look like "bma-1x2y3z"; past-exam ids
 * are "<exam id>-<n>", e.g. "fin-2013-icdc-1088-12" (see src/data/exams.ts).
 */
export async function loadQuestionsById(ids: string[]): Promise<Question[]> {
  const pastIds = [...new Set(ids.map((id) => PAST_EXAMS.find((x) => id.startsWith(`${x.id}-`))).filter((x) => !!x))]
  const banks = [...new Set(ids.map((id) => id.split('-')[0]))].filter(hasBank)
  const all = (await Promise.all([...banks.map(loadQuestions), ...pastIds.map(loadExam)])).flat()
  const want = new Set(ids)
  return all.filter((x) => want.has(x.id))
}

export function useQuestions(exam: ExamId) {
  const [state, setState] = useState<{ exam: ExamId; questions: Question[] | null; error: string | null }>({ exam, questions: null, error: null })
  useEffect(() => {
    let live = true
    setState({ exam, questions: null, error: null })
    loadQuestions(exam).then(
      (questions) => live && setState({ exam, questions, error: null }),
      (e: Error) => live && setState({ exam, questions: null, error: e.message }),
    )
    return () => { live = false }
  }, [exam])
  return state.exam === exam ? state : { exam, questions: null, error: null }
}

export const shuffle = <T,>(a: T[]) => {
  const b = [...a]
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[b[i], b[j]] = [b[j], b[i]]
  }
  return b
}

/** n random questions. */
export const sample = (qs: Question[], n: number) => shuffle(qs).slice(0, n)

export const VOCAB: { term: string; def: string; exam: ExamId }[] = [
  { term: 'Opportunity cost', def: 'The value of the next-best alternative given up when making a choice.', exam: 'bac' },
  { term: 'Contract', def: 'A legally binding agreement between two or more parties.', exam: 'bac' },
  { term: 'Span of control', def: 'The number of employees a manager directly supervises.', exam: 'bma' },
  { term: 'Kaizen', def: 'A practice of making small, continuous improvements to processes.', exam: 'bma' },
  { term: 'Bootstrapping', def: 'Starting a business using personal savings and revenue rather than outside capital.', exam: 'ent' },
  { term: 'Equity financing', def: 'Raising money by selling ownership shares in a business.', exam: 'ent' },
  { term: 'Liquidity', def: 'How quickly an asset can be converted to cash without losing value.', exam: 'fin' },
  { term: 'Gross profit', def: 'Revenue minus cost of goods sold.', exam: 'fin' },
  { term: 'RevPAR', def: 'Revenue per available room, a key hotel performance metric.', exam: 'ht' },
  { term: 'Yield management', def: 'Adjusting prices based on expected demand to maximize revenue.', exam: 'ht' },
  { term: 'Market share', def: 'A company’s sales as a percentage of total industry sales.', exam: 'mkt' },
  { term: 'Channel of distribution', def: 'The path a product takes from producer to final consumer.', exam: 'mkt' },
  { term: 'Compound interest', def: 'Interest earned on both the principal and previously earned interest.', exam: 'pfl' },
  { term: 'Net pay', def: 'Take-home pay after taxes and deductions.', exam: 'pfl' },
]
