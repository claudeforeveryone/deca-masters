import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, XCircle, Timer } from 'lucide-react'
import { eventName, type Question } from '../data/mock'

export type QuizResult = { correct: number; total: number; seconds: number; wrongIds: string[] }

type Props = {
  title: string
  questions: Question[]
  timeLimitSec?: number // overall timer; omitted = count up
  eloPerCorrect?: number
  showExplanations?: boolean
  onFinish: (r: QuizResult) => void
  onExit?: () => void
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function QuizRunner({ title, questions, timeLimitSec, eloPerCorrect = 8, showExplanations = true, onFinish, onExit }: Props) {
  const [i, setI] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)
  const [correct, setCorrect] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const score = useRef({ correct: 0, wrong: [] as string[], done: false })
  const elapsedRef = useRef(0)
  elapsedRef.current = elapsed

  const finish = () => {
    if (score.current.done) return
    score.current.done = true
    onFinish({ correct: score.current.correct, total: questions.length, seconds: elapsedRef.current, wrongIds: score.current.wrong })
  }

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000)
    return () => clearInterval(t)
  }, [])

  const remaining = timeLimitSec ? Math.max(0, timeLimitSec - elapsed) : null
  useEffect(() => {
    if (remaining === 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  const q = questions[i]

  const next = () => {
    if (i + 1 >= questions.length) return finish()
    setI(i + 1)
    setPicked(null)
  }

  const choose = (idx: number) => {
    if (picked !== null) return
    setPicked(idx)
    if (idx === q.answer) score.current.correct++
    else score.current.wrong.push(q.id)
    setCorrect(score.current.correct)
    if (!showExplanations) setTimeout(next, 600)
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold">{title}</h2>
          <p className="muted">
            Question {i + 1} of {questions.length} · {eventName(q.event)} · {q.instructionalArea}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip text-sm ${remaining !== null && remaining < 15 ? 'bg-red-100 text-red-600' : ''}`}>
            <Timer className="h-4 w-4" /> {fmtTime(remaining ?? elapsed)}
          </span>
          <span className="chip text-sm">+{correct * eloPerCorrect} ELO</span>
          {onExit && <button onClick={onExit} className="btn-ghost py-1">Exit</button>}
        </div>
      </div>

      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-sky-100">
        <div className="h-full bg-deca transition-all" style={{ width: `${(i / questions.length) * 100}%` }} />
      </div>

      <div className="card p-6">
        <p className="text-lg font-semibold leading-relaxed">{q.prompt}</p>
        <div className="mt-5 grid gap-3">
          {q.choices.map((c, idx) => {
            const state =
              picked === null ? '' : idx === q.answer ? 'border-green-500 bg-green-50' : idx === picked ? 'border-red-400 bg-red-50' : 'opacity-60'
            return (
              <button
                key={idx}
                onClick={() => choose(idx)}
                className={`flex items-center gap-3 rounded-xl border-2 border-sky-100 bg-white px-4 py-3 text-left transition hover:border-deca ${state}`}
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-sky-100 text-sm font-bold text-deca-dark">
                  {'ABCD'[idx]}
                </span>
                <span className="flex-1">{c}</span>
                {picked !== null && idx === q.answer && <CheckCircle2 className="h-5 w-5 text-green-600" />}
                {picked === idx && idx !== q.answer && <XCircle className="h-5 w-5 text-red-500" />}
              </button>
            )
          })}
        </div>

        {picked !== null && showExplanations && (
          <div className="mt-5 rounded-xl bg-sky-50 p-4 text-sm">
            <span className="font-bold">{picked === q.answer ? 'Correct! ' : 'Not quite. '}</span>
            {q.explanation}
            <div className="mt-3 text-right">
              <button className="btn-primary" onClick={next}>
                {i + 1 >= questions.length ? 'Finish' : 'Next question'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function ResultCard({ r, eloPerCorrect = 8, onAgain, onDone }: { r: QuizResult; eloPerCorrect?: number; onAgain?: () => void; onDone: () => void }) {
  const pct = Math.round((r.correct / r.total) * 100)
  const delta = r.correct * eloPerCorrect - (r.total - r.correct) * Math.round(eloPerCorrect / 2)
  return (
    <div className="card mx-auto max-w-md p-8 text-center">
      <div className="text-5xl font-extrabold text-deca">{pct}%</div>
      <p className="mt-1 text-navy/60">
        {r.correct} / {r.total} correct · {fmtTime(r.seconds)}
      </p>
      <p className={`mt-4 text-lg font-bold ${delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
        {delta >= 0 ? '+' : ''}
        {delta} ELO
      </p>
      <div className="mt-6 flex justify-center gap-2">
        {onAgain && <button className="btn-ghost" onClick={onAgain}>Try again</button>}
        <button className="btn-primary" onClick={onDone}>Done</button>
      </div>
    </div>
  )
}
