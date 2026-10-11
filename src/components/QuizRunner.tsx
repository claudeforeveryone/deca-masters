import { useEffect, useRef, useState } from 'react'
import { CheckCircle, XCircle, Timer, X, ArrowRight, ArrowCounterClockwise } from '@phosphor-icons/react'
import { examOf } from '../data/events'
import type { Question } from '../data/questions'
import { cue, cueFinish } from '../sound'

export type QuizResult = { correct: number; total: number; seconds: number; wrongIds: string[] }

type Props = {
  title: string
  questions: Question[]
  timeLimitSec?: number // overall timer; omitted = count up
  eloPerCorrect?: number
  showExplanations?: boolean
  /** When the session began (epoch ms). The clock runs on real time, so leaving the tab or the page does not pause it. */
  startedAt?: number
  /** Answers already given, for resuming a session. Answered questions stay locked. */
  initialAnswers?: (number | null)[]
  /** Called after every answer so the session can be saved and resumed. */
  onAnswer?: (answers: (number | null)[]) => void
  /** Count unanswered questions as wrong (Arena). Otherwise only answered questions are scored. */
  countUnanswered?: boolean
  onFinish: (r: QuizResult) => void
  /** Shows an exit button. Exiting scores what you have answered so far; with no answers it just leaves. */
  onExit?: () => void
}

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function QuizRunner({ title, questions, timeLimitSec, eloPerCorrect = 8, showExplanations = true, startedAt, initialAnswers, onAnswer, countUnanswered = false, onFinish, onExit }: Props) {
  const [start] = useState(() => startedAt ?? Date.now())
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map((_, k) => initialAnswers?.[k] ?? null))
  const [i, setI] = useState(() => {
    const k = answers.findIndex((a) => a === null)
    return k < 0 ? questions.length - 1 : k
  })
  const [now, setNow] = useState(Date.now)
  const done = useRef(false)
  const answersRef = useRef(answers)
  answersRef.current = answers

  const elapsed = Math.max(0, Math.floor((now - start) / 1000))
  const picked = answers[i]

  const finish = () => {
    if (done.current) return
    done.current = true
    const a = answersRef.current
    const answered = questions.filter((_, k) => a[k] !== null)
    const scored = countUnanswered ? questions : answered
    const wrong = scored.filter((q) => a[questions.indexOf(q)] !== q.answer)
    const seconds = Math.floor((Date.now() - start) / 1000)
    onFinish({ correct: scored.length - wrong.length, total: scored.length, seconds: timeLimitSec ? Math.min(seconds, timeLimitSec) : seconds, wrongIds: wrong.map((q) => q.id) })
  }

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [])

  const remaining = timeLimitSec ? Math.max(0, timeLimitSec - elapsed) : null
  useEffect(() => {
    if (remaining === 0) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining])

  // A resumed session whose questions are all answered is already over.
  useEffect(() => {
    if (answers.every((a) => a !== null) && !showExplanations) finish()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const q = questions[i]
  const last = i + 1 >= questions.length

  const next = () => {
    if (done.current) return
    if (last) return finish()
    setI((k) => Math.min(k + 1, questions.length - 1))
  }

  const choose = (idx: number) => {
    if (done.current || answersRef.current[i] !== null || remaining === 0) return
    const updated = answersRef.current.map((v, k) => (k === i ? idx : v))
    answersRef.current = updated
    setAnswers(updated)
    onAnswer?.(updated)
    // Right answers in a row climb in pitch.
    let streak = 0
    while (streak <= i && updated[i - streak] === questions[i - streak].answer) streak++
    cue(streak ? 'correct' : 'wrong', { streak })
    if (!showExplanations) setTimeout(next, 550)
  }

  const exit = () => {
    if (!onExit) return
    if (answersRef.current.some((a) => a !== null)) finish()
    else onExit()
  }

  // Keyboard: A-D or 1-4 to answer, Enter to continue.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.repeat) return
      const k = e.key.toLowerCase()
      const idx = 'abcd'.indexOf(k) >= 0 ? 'abcd'.indexOf(k) : '1234'.indexOf(k)
      if (idx >= 0 && idx < q.choices.length) choose(idx)
      else if (k === 'enter' && picked !== null && showExplanations) next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const results = questions.map((qq, k) => (answers[k] === null ? null : answers[k] === qq.answer))
  const correctSoFar = results.filter(Boolean).length
  const lowTime = remaining !== null && remaining <= 15

  return (
    <div className="mx-auto max-w-2xl pt-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-bold uppercase tracking-label text-brand">{title}</p>
          <p className="text-[13px] text-ink-3">
            {examOf(q.exam).name}, {q.area}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`num inline-flex items-center gap-1.5 rounded-soft border px-2 py-1 text-sm ${lowTime ? 'border-bad/30 bg-bad-bg text-bad' : 'border-line text-ink-2'}`}>
            <Timer size={15} /> {fmtTime(remaining ?? elapsed)}
          </span>
          <span className="num rounded-soft border border-line px-2 py-1 text-sm text-ink-2">+{correctSoFar * eloPerCorrect}</span>
          {onExit && (
            <button onClick={exit} className="btn-ghost w-9 px-0" aria-label="End session" title="End session. Questions you answered still count.">
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="mb-8 flex gap-1" aria-label={`Question ${i + 1} of ${questions.length}`}>
        {results.map((r, k) => (
          <span
            key={k}
            className={`h-1.5 flex-1 transition-colors ${
              r === true ? 'bg-brand' : r === false ? 'bg-bad' : k === i ? 'bg-ink-3' : 'bg-line'
            }`}
          />
        ))}
      </div>

      <p className="num mb-2 text-[13px] text-ink-3">
        {String(i + 1).padStart(2, '0')} / {String(questions.length).padStart(2, '0')}
      </p>
      <h2 key={q.id + i} className="enter text-xl font-semibold leading-snug sm:text-2xl">{q.prompt}</h2>

      <div className="mt-6 grid gap-2.5">
        {q.choices.map((c, idx) => {
          const isAnswer = idx === q.answer
          const state =
            picked === null
              ? 'border-line bg-white hover:border-brand hover:bg-tint'
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
              className={`flex items-center gap-4 border-2 px-4 py-4 text-left transition-colors disabled:cursor-default ${state}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center text-[13px] font-bold ${picked === null ? "bg-canvas text-ink" : "bg-surface/70 text-ink"}`}>
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
        <div className="enter mt-6 flex flex-col gap-4 rounded-r-box border-l-4 border-brand bg-canvas p-5 sm:flex-row sm:items-end sm:justify-between">
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

export function ResultCard({ r, delta, title = 'Session complete', onAgain, onDone, note }: { r: QuizResult; delta: number; title?: string; onAgain?: () => void; onDone: () => void; note?: string }) {
  const pct = r.total ? Math.round((r.correct / r.total) * 100) : 0
  // Once per result, even when StrictMode mounts it twice.
  const cheered = useRef(false)
  useEffect(() => {
    if (cheered.current || r.total === 0) return
    cheered.current = true
    cueFinish(delta)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="surface enter mx-auto mt-12 max-w-md border-t-4 border-t-brand p-8">
      <p className="text-[11px] font-bold uppercase tracking-label text-brand">{title}</p>
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
      {note && <p className="mt-5 text-sm text-ink-3">{note}</p>}
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
