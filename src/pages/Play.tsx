import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarCheck, Infinity as InfinityIcon, Crosshair, Timer, FileText, ClipboardText } from '@phosphor-icons/react'
import { EVENTS, MY_STATS, QUESTIONS, eventName, eventOf, type EventId, type Question } from '../data/mock'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'
import { ArrowLink, ClusterBar, EventIcon, Meter, PageBand, SectionHeader } from '../components/ui'

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
  const [eventId, setEventId] = useState<EventId>(() => {
    const e = params.get('event')
    return EVENTS.some((x) => x.id === e) ? (e as EventId) : 'marketing'
  })

  const weakEvents = useMemo(() => [...MY_STATS.bySection].sort((a, b) => a.accuracy - b.accuracy).slice(0, 2), [])
  const weakQs = () => QUESTIONS.filter((q) => weakEvents.some((w) => w.event === q.event))

  const MODES = [
    { key: 'daily', icon: CalendarCheck, title: 'Daily', body: '10 questions, new each day.', s: { title: 'Daily challenge', questions: QUESTIONS, explanations: true } },
    { key: 'endless', icon: InfinityIcon, title: 'Endless', body: 'Keep going as long as you like.', s: { title: 'Endless', questions: shuffle([...QUESTIONS, ...QUESTIONS, ...QUESTIONS]), explanations: true } },
    { key: 'weak', icon: Crosshair, title: 'Weak spots', body: `${weakEvents.map((w) => eventName(w.event)).join(' and ')}.`, s: { title: 'Weak spots', questions: weakQs(), explanations: true } },
    { key: 'sprint', icon: Timer, title: 'Sprint', body: '10 questions in 2 minutes.', s: { title: 'Sprint', questions: shuffle(QUESTIONS), timeLimitSec: 120, explanations: false } },
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

  const ev = eventOf(eventId)
  const stat = MY_STATS.bySection.find((s) => s.event === eventId)!

  return (
    <div>
      <PageBand
        tag="Practice"
        title="Play"
        description="Practice exams for every DECA career cluster. Correct answers earn ELO and misses cost a little."
      />

      <section className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map(({ key, icon: Icon, title, body, s }) => (
          <button
            key={key}
            onClick={() => start({ ...s, questions: [...s.questions] })}
            className="group flex flex-col items-start bg-white p-6 text-left transition-colors hover:bg-tint"
          >
            <Icon size={28} className="text-brand" />
            <span className="mt-4 text-lg font-semibold tracking-head text-ink">{title}</span>
            <span className="mt-1 text-sm text-ink-3">{body}</span>
            <span className="mt-5 text-[13px] font-semibold tracking-label text-brand group-hover:underline">Start</span>
          </button>
        ))}
      </section>

      <section className="mt-16">
        <SectionHeader title="Assigned to you" />
        <ul className="space-y-3">
          {ASSIGNED.map((a) => (
            <li key={a.title} className="panel flex items-center gap-4 p-5">
              <ClipboardText size={24} className="shrink-0 text-brand" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-brand">{a.title}</p>
                <p className="truncate text-sm text-ink-3">{a.by}</p>
              </div>
              <span className="hidden text-sm text-ink-2 sm:block">Due {a.due}</span>
              <button
                className="btn-primary btn-sm"
                onClick={() => start({ title: a.title, questions: shuffle(QUESTIONS.filter((q) => q.event === a.event).concat(QUESTIONS.slice(0, 3))), explanations: true })}
              >
                Start
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16">
        <SectionHeader title="Practice exams by career cluster" />
        <ClusterBar onSelect={setEventId} active={eventId} />

        <div className="mt-px grid lg:grid-cols-[320px_1fr]">
          <div className="p-8" style={{ background: ev.color, color: ev.fg }}>
            <EventIcon id={eventId} size={32} />
            <h3 className="mt-4 text-2xl" style={{ color: ev.fg }}>{ev.name}</h3>
            <p className="num mt-6 text-5xl font-extrabold">{stat.accuracy}%</p>
            <p className="mt-1 text-sm opacity-90">your accuracy over {stat.done} questions</p>
          </div>
          <ul className="divide-y divide-line border border-line lg:border-l-0">
            {EXAMS.map((x) => (
              <li key={x.n} className="flex items-center gap-4 px-6 py-5">
                <FileText size={22} className="shrink-0 text-ink-3" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{ev.name} exam {x.n}</p>
                  <p className="num text-xs text-ink-3">{x.len} questions, {x.mins} minutes</p>
                </div>
                <div className="hidden w-32 sm:block">
                  {x.best ? (
                    <>
                      <p className="num mb-1 text-right text-xs text-ink-2">Best {x.best}%</p>
                      <Meter value={x.best} />
                    </>
                  ) : (
                    <p className="text-right text-xs text-ink-3">Not taken</p>
                  )}
                </div>
                <ArrowLink onClick={() => start({ title: `${ev.name} exam ${x.n}`, questions: shuffle(QUESTIONS), timeLimitSec: 600, explanations: false })}>Take</ArrowLink>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
