import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Timer, X, ArrowRight, ArrowCounterClockwise } from '@phosphor-icons/react'
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
  const [results, setResults] = useState<(boolean | null)[]>(() => questions.map(() => null))
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
  const last = i + 1 >= questions.length

  const next = () => {
    if (last) return finish()
    setI(i + 1)
    setPicked(null)
  }

  const choose = (idx: number) => {
    if (picked !== null) return
    setPicked(idx)
    const ok = idx === q.answer
    if (ok) score.current.correct++
    else score.current.wrong.push(q.id)
    setResults((r) => r.map((v, k) => (k === i ? ok : v)))
    if (!showExplanations) setTimeout(next, 550)
  }

  // Keyboard: A-D or 1-4 to answer, Enter to continue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const k = e.key.toLowerCase()
      const idx = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k)
      if (idx >= 0 && idx < q.choices.length) choose(idx)
      else if (k === 'enter' && picked !== null && showExplanations) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const correctSoFar = results.filter(Boolean).length
  const lowTime = remaining !== null && remaining <= 15

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-[13px] text-ink-3">
            {eventName(q.event)}, {q.instructionalArea}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`num inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-sm ${lowTime ? 'border-bad/30 bg-bad-bg text-bad' : 'border-line text-ink-2'}`}>
            <Timer size={15} /> {fmtTime(remaining ?? elapsed)}
          </span>
          <span className="num rounded-md border border-line px-2 py-1 text-sm text-ink-2">+{correctSoFar * eloPerCorrect}</span>
          {onExit && (
            <button onClick={onExit} className="btn-ghost w-9 px-0" aria-label="Exit">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-8 flex gap-1" aria-label={`Question ${i + 1} of ${questions.length}`}>
        {results.map((r, k) => (
          <span
            key={k}
            className={`h-1 flex-1 rounded-full transition-colors ${
              r === true ? 'bg-brand' : r === false ? 'bg-bad' : k === i ? 'bg-ink-3' : 'bg-line'
            }`}
          />
        ))}
      </div>

      <p className="num mb-2 text-[13px] text-ink-3">
        {String(i + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
      </p>
      <h2 key={q.id + i} className="enter text-xl font-medium leading-snug sm:text-[22px]">{q.prompt}</h2>

      <div className="mt-6 grid gap-2.5">
        {q.choices.map((c, idx) => {
          const isAnswer = idx === q.answer
          const state =
            picked === null
              ? 'border-line bg-white hover:border-brand/50 hover:bg-tint/40'
              : isAnswer
                ? 'border-good bg-good-bg'
                : idx === picked
                  ? 'border-bad bg-bad-bg'
                  : 'border-line bg-white opacity-55'
          return (
            <button
              key={idx}
              onClick={() => choose(idx)}
              disabled={picked !== null}
              className={`flex items-center gap-3.5 rounded-xl border px-4 py-3.5 text-left transition-colors disabled:cursor-default ${state}`}
            >
              <span className={`num grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[13px] ${picked === null ? 'border-line text-ink-3' : 'border-transparent text-ink-2'}`}>
                {'ABCD'[idx]}
              </span>
              <span className="flex-1 text-[15px]">{c}</span>
              {picked !== null && isAnswer && <CheckCircle size={20} weight="fill" className="text-good" />}
              {picked === idx && !isAnswer && <XCircle size={20} weight="fill" className="text-bad" />}
            </button>
          )
        })}
      </div>

      {picked !== null && showExplanations && (
        <div className="enter mt-6 flex flex-col gap-4 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={`text-sm font-semibold ${picked === q.answer ? 'text-good' : 'text-bad'}`}>{picked === q.answer ? 'Correct' : 'Incorrect'}</p>
            <p className="mt-1 max-w-[52ch] text-sm text-ink-2">{q.explanation}</p>
          </div>
          <button className="btn-primary shrink-0" onClick={next} autoFocus>
            {last ? 'See results' : 'Next'} <ArrowRight size={16} />
          </button>
        </div>
      )}
      {picked === null && <p className="mt-6 hidden text-xs text-ink-3 sm:block">Tip: press A to D to answer.</p>}
    </div>
  )
}

export function ResultCard({ r, eloPerCorrect = 8, title = 'Session complete', onAgain, onDone }: { r: QuizResult; eloPerCorrect?: number; title?: string; onAgain?: () => void; onDone: () => void }) {
  const pct = Math.round((r.correct / r.total) * 100)
  const delta = r.correct * eloPerCorrect - (r.total - r.correct) * Math.round(eloPerCorrect / 2)
  return (
    <div className="surface enter mx-auto max-w-md p-8">
      <p className="text-sm text-ink-3">{title}</p>
      <p className="num mt-2 text-5xl font-semibold">{pct}%</p>
      <dl className="mt-6 grid grid-cols-3 gap-4 border-t border-line pt-5">
        <div>
          <dt className="text-xs text-ink-3">Correct</dt>
          <dd className="num mt-0.5 font-medium">{r.correct}/{r.total}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">Time</dt>
          <dd className="num mt-0.5 font-medium">{fmtTime(r.seconds)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-3">ELO</dt>
          <dd className={`num mt-0.5 font-medium ${delta >= 0 ? 'text-good' : 'text-bad'}`}>{delta >= 0 ? '+' : ''}{delta}</dd>
        </div>
      </dl>
      <div className="mt-8 flex gap-2">
        <button className="btn-primary flex-1" onClick={onDone}>Done</button>
        {onAgain && (
          <button className="btn-secondary" onClick={onAgain}>
            <ArrowCounterClockwise size={16} /> Retry
          </button>
        )}
      </div>
    </div>
  )
}
