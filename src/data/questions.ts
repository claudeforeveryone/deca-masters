import { useEffect, useState } from 'react'
import type { ExamId } from './events'
import COUNTS from './questionCounts.json'

// The question banks for each cluster exam live in public/questions/<exam>.json, built from
// past DECA exam booklets by scripts/build-questions.mjs. They are a few MB each, so they
// are fetched on demand rather than bundled.
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

const q = (id: string, exam: ExamId, area: string, prompt: string, choices: string[], answer: number, explanation: string): Question => ({
  id, exam, area, prompt, choices, answer, explanation,
})

// Personal Financial Literacy has no booklet bank yet, so it keeps these sample questions.
const PFL_SAMPLES: Question[] = [
  q('pfl-1', 'pfl', 'Saving', 'Interest earned on both the original deposit and previously earned interest is', ['simple interest', 'compound interest', 'a dividend', 'principal'], 1, 'Compound interest grows on interest already earned.'),
  q('pfl-2', 'pfl', 'Credit', 'Which factor has the largest effect on a FICO credit score?', ['Payment history', 'Length of credit history', 'New credit', 'Types of credit'], 0, 'Payment history makes up the largest share of a FICO score.'),
  q('pfl-3', 'pfl', 'Budgeting', 'Money set aside to cover unexpected expenses like car repairs is a(n)', ['emergency fund', 'retirement account', 'line of credit', 'escrow account'], 0, 'An emergency fund covers surprises without taking on debt.'),
  q('pfl-4', 'pfl', 'Earning Income', 'The amount of pay left after taxes and deductions is', ['gross pay', 'net pay', 'salary', 'overtime'], 1, 'Net pay is your take-home pay.'),
  q('pfl-5', 'pfl', 'Investing', 'Which investment generally carries the highest risk and potential return?', ['Savings account', 'Certificate of deposit', 'Individual stocks', 'Government bonds'], 2, 'Individual stocks can swing widely in value, so risk and potential return are higher.'),
]

const BANKED = ['bac', 'bma', 'ent', 'fin', 'ht', 'mkt'] as const
const hasBank = (exam: ExamId): exam is (typeof BANKED)[number] => (BANKED as readonly string[]).includes(exam)

export const questionCount = (exam: ExamId) => (hasBank(exam) ? COUNTS[exam] : PFL_SAMPLES.length)

const cache = new Map<ExamId, Promise<Question[]>>()

export function loadQuestions(exam: ExamId): Promise<Question[]> {
  if (!hasBank(exam)) return Promise.resolve(PFL_SAMPLES.filter((x) => x.exam === exam))
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

/** Loads every exam a list of question ids comes from. Ids start with their exam, e.g. "bma-1x2y3z". */
export async function loadQuestionsById(ids: string[]): Promise<Question[]> {
  const exams = [...new Set(ids.map((id) => id.split('-')[0]))].filter((x): x is ExamId => hasBank(x as ExamId) || x === 'pfl')
  const all = (await Promise.all(exams.map(loadQuestions))).flat()
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
