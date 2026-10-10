import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, Infinity as InfinityIcon, Crosshair, Timer, FileText, ClipboardText, ArrowRight } from '@phosphor-icons/react'
import { EVENTS, MY_STATS, QUESTIONS, eventName, type EventId, type Question } from '../data/mock'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'
import { Meter, PageHeader } from '../components/ui'

type Session = { title: string; questions: Question[]; timeLimitSec?: number; explanations: boolean }

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5)

const ASSIGNED = [
  { title: 'Ratios flashcard set', by: 'Jordan Lee, Finance trainer', due: 'Oct 12', event: 'finance' as EventId },
  { title: 'Marketing mock exam (shuffled)', by: 'Sofia Ramirez, VP', due: 'Oct 15', event: 'marketing' as EventId },
]

const EXAMS = [
  { n: 1, len: 100, mins: 60, best: 78 },
  { n: 2, len: 100, mins: 60, best: 84 },
  { n: 3, len: 100, mins: 60, best: null },
  { n: 4, len: 100, mins: 60, best: null },
]

export default function Play() {
  const [params, setParams] = useSearchParams()
  const [session, setSession] = useState<Session | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [eventId, setEventId] = useState<EventId>('marketing')

  const weakEvents = useMemo(() => [...MY_STATS.bySection].sort((a, b) => a.accuracy - b.accuracy).slice(0, 2), [])
  const weakQs = () => QUESTIONS.filter((q) => weakEvents.some((w) => w.event === q.event))

  const MODES = [
    { key: 'daily', icon: CalendarCheck, title: 'Daily', body: '10 questions, new each day', s: { title: 'Daily challenge', questions: QUESTIONS, explanations: true } },
    { key: 'endless', icon: InfinityIcon, title: 'Endless', body: 'Keep going as long as you like', s: { title: 'Endless', questions: shuffle([...QUESTIONS, ...QUESTIONS, ...QUESTIONS]), explanations: true } },
    { key: 'weak', icon: Crosshair, title: 'Weak spots', body: weakEvents.map((w) => eventName(w.event)).join(' and '), s: { title: 'Weak spots', questions: weakQs(), explanations: true } },
    { key: 'sprint', icon: Timer, title: 'Sprint', body: '10 questions in 2 minutes', s: { title: 'Sprint', questions: shuffle(QUESTIONS), timeLimitSec: 120, explanations: false } },
  ] as const

  const start = (s: Session) => {
    setResult(null)
    setSession(s)
  }

  const mode = params.get('mode')
  useEffect(() => {
    if (!mode) return
    setParams({}, { replace: true })
    const m = MODES.find((x) => x.key === mode)
    if (m) start({ ...m.s, questions: [...m.s.questions] })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  if (session && result)
    return (
      <ResultCard
        r={result}
        title={session.title}
        onAgain={() => start({ ...session, questions: shuffle(session.questions) })}
        onDone={() => { setSession(null); setResult(null) }}
      />
    )
  if (session)
    return (
      <QuizRunner
        title={session.title}
        questions={session.questions}
        timeLimitSec={session.timeLimitSec}
        showExplanations={session.explanations}
        onFinish={setResult}
        onExit={() => setSession(null)}
      />
    )

  const stat = MY_STATS.bySection.find((s) => s.event === eventId)!

  return (
    <div className="space-y-10">
      <PageHeader title="Play" description="Practice for every DECA cluster. Right answers earn ELO, misses cost a little." />

      <section className="surface grid divide-y divide-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
        {MODES.map(({ key, icon: Icon, title, body, s }, i) => (
          <button
            key={key}
            onClick={() => start({ ...s, questions: [...s.questions] })}
            className={`group flex items-start gap-3.5 p-5 text-left transition-colors hover:bg-canvas ${i % 2 === 1 ? 'sm:border-l sm:border-line lg:border-l-0' : ''} ${i >= 2 ? 'sm:border-t sm:border-line lg:border-t-0' : ''}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint text-brand transition-colors group-hover:bg-brand group-hover:text-white">
              <Icon size={19} />
            </span>
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="mt-0.5 block text-sm text-ink-3">{body}</span>
            </span>
          </button>
        ))}
      </section>

      <section>
        <h2 className="h-section mb-3">Assigned to you</h2>
        <ul className="surface divide-y divide-line">
          {ASSIGNED.map((a) => (
            <li key={a.title} className="flex items-center gap-4 px-5 py-4">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint text-brand"><ClipboardText size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{a.title}</p>
                <p className="truncate text-sm text-ink-3">{a.by}</p>
              </div>
              <span className="hidden text-sm text-ink-3 sm:block">Due {a.due}</span>
              <button
                className="btn-secondary btn-sm"
                onClick={() => start({ title: a.title, questions: shuffle(QUESTIONS.filter((q) => q.event === a.event).concat(QUESTIONS.slice(0, 3))), explanations: true })}
              >
                Start
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="h-section mb-3">Practice exams</h2>
        <div className="grid gap-6 md:grid-cols-[240px_1fr]">
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 md:mx-0 md:flex-col md:overflow-visible md:px-0" aria-label="Events">
            {EVENTS.map((e) => (
              <button
                key={e.id}
                onClick={() => setEventId(e.id)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                  eventId === e.id ? 'bg-tint text-brand' : 'text-ink-2 hover:bg-white hover:text-ink'
                }`}
              >
                {e.name}
              </button>
            ))}
          </nav>

          <div className="surface">
            <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold">{eventName(eventId)}</p>
                <p className="text-sm text-ink-3">{stat.done} questions answered</p>
              </div>
              <div className="flex items-center gap-3 sm:w-56">
                <Meter value={stat.accuracy} />
                <span className="num text-sm font-medium">{stat.accuracy}%</span>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {EXAMS.map((x) => (
                <li key={x.n} className="flex items-center gap-4 px-5 py-3.5">
                  <FileText size={18} className="shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{eventName(eventId)} exam {x.n}</p>
                    <p className="num text-xs text-ink-3">{x.len} questions, {x.mins} min</p>
                  </div>
                  <span className="num hidden w-20 text-right text-sm text-ink-3 sm:block">{x.best ? `Best ${x.best}%` : 'Not taken'}</span>
                  <button
                    className="btn-ghost btn-sm text-brand"
                    onClick={() => start({ title: `${eventName(eventId)} exam ${x.n}`, questions: shuffle(QUESTIONS), timeLimitSec: 600, explanations: false })}
                  >
                    Take <ArrowRight size={14} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  )
}
