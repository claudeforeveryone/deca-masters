import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Infinity as InfinityIcon, Target, Timer, FileText, ClipboardList } from 'lucide-react'
import { EVENTS, MY_STATS, QUESTIONS, eventName, type EventId, type Question } from '../data/mock'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'
import { Bar, PageHeader } from '../components/ui'

type Session = { title: string; questions: Question[]; timeLimitSec?: number; explanations: boolean }

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5)

const ASSIGNED = [
  { title: 'Ratios flashcard set', by: 'Jordan Lee (Finance Trainer)', due: 'Oct 12', event: 'finance' as EventId },
  { title: 'Marketing mock exam — shuffled', by: 'Sofia Ramirez (VP)', due: 'Oct 15', event: 'marketing' as EventId },
]

export default function Play() {
  const [params, setParams] = useSearchParams()
  const [session, setSession] = useState<Session | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)
  const [eventFilter, setEventFilter] = useState<EventId | 'all'>('all')

  const weakEvents = useMemo(() => [...MY_STATS.bySection].sort((a, b) => a.accuracy - b.accuracy).slice(0, 2), [])

  const start = (s: Session) => {
    setResult(null)
    setSession(s)
  }

  // Deep links from Home (?mode=daily etc.)
  const mode = params.get('mode')
  useEffect(() => {
    if (!mode) return
    setParams({}, { replace: true })
    if (mode === 'daily') start({ title: 'Daily Challenge', questions: QUESTIONS, explanations: true })
    if (mode === 'endless') start({ title: 'Endless', questions: shuffle([...QUESTIONS, ...QUESTIONS, ...QUESTIONS]), explanations: true })
    if (mode === 'weak') start({ title: 'Weak Spots', questions: QUESTIONS.filter((q) => weakEvents.some((w) => w.event === q.event)), explanations: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  if (session && result)
    return (
      <ResultCard
        r={result}
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

  const byEvent = (id: EventId) => QUESTIONS.filter((q) => q.event === id)

  return (
    <div className="space-y-8">
      <PageHeader title="Play" subtitle="Practice exams for every DECA career cluster. Correct answers earn ELO, misses cost a little." />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: CalendarDays, title: 'Daily', desc: '10 fresh questions every day. Keep your streak.', s: { title: 'Daily Challenge', questions: QUESTIONS, explanations: true } },
          { icon: InfinityIcon, title: 'Endless', desc: 'Non-stop questions from every cluster.', s: { title: 'Endless', questions: shuffle([...QUESTIONS, ...QUESTIONS]), explanations: true } },
          { icon: Target, title: 'Weak Spots', desc: `Your lowest: ${weakEvents.map((w) => eventName(w.event)).join(', ')}`, s: { title: 'Weak Spots', questions: QUESTIONS.filter((q) => weakEvents.some((w) => w.event === q.event)), explanations: true } },
          { icon: Timer, title: 'Timed Sprint', desc: '10 questions in 2 minutes. No explanations.', s: { title: 'Timed Sprint', questions: shuffle(QUESTIONS), timeLimitSec: 120, explanations: false } },
        ].map(({ icon: Icon, title, desc, s }) => (
          <button key={title} onClick={() => start(s)} className="card group p-5 text-left transition hover:-translate-y-0.5 hover:border-deca">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-navy text-deca-light group-hover:bg-deca group-hover:text-white">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-3 text-lg font-bold">{title}</h3>
            <p className="muted">{desc}</p>
          </button>
        ))}
      </section>

      <section>
        <h2 className="section-title mb-3 flex items-center gap-2"><ClipboardList className="h-5 w-5 text-deca" /> Assigned to you</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {ASSIGNED.map((a) => (
            <div key={a.title} className="card flex items-center justify-between gap-3 p-4">
              <div>
                <p className="font-semibold">{a.title}</p>
                <p className="text-xs text-navy/50">{a.by} · due {a.due}</p>
              </div>
              <button className="btn-primary" onClick={() => start({ title: a.title, questions: shuffle(byEvent(a.event).concat(QUESTIONS.slice(0, 3))), explanations: true })}>
                Start
              </button>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="section-title">Practice exams by event</h2>
          <select className="input w-auto" value={eventFilter} onChange={(e) => setEventFilter(e.target.value as EventId | 'all')}>
            <option value="all">All events</option>
            {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {EVENTS.filter((e) => eventFilter === 'all' || e.id === eventFilter).map((e) => {
            const stat = MY_STATS.bySection.find((s) => s.event === e.id)!
            return (
              <div key={e.id} className="card overflow-hidden">
                <div className="h-2" style={{ background: e.color }} />
                <div className="p-5">
                  <h3 className="text-lg font-bold">{e.name}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs text-navy/60">
                    <span>Your accuracy</span>
                    <Bar value={stat.accuracy} color={e.color} />
                    <span className="font-bold text-navy">{stat.accuracy}%</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {[1, 2, 3, 4].map((n) => (
                      <li key={n} className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2">
                        <span className="flex items-center gap-2 text-sm font-medium">
                          <FileText className="h-4 w-4 text-deca" /> {e.name} Exam #{n}
                        </span>
                        <button
                          className="text-sm font-semibold text-deca hover:underline"
                          onClick={() => start({ title: `${e.name} Exam #${n}`, questions: shuffle(QUESTIONS), timeLimitSec: 60 * 10, explanations: false })}
                        >
                          Take →
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
