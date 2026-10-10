import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarCheck, Infinity as InfinityIcon, Crosshair, Timer, FileText, ClipboardText } from '@phosphor-icons/react'
import { EXAMS, examOf, type ExamId } from '../data/events'
import { questionsFor, type Question } from '../data/questions'
import { useMyEvent, useStore } from '../store'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'
import { ArrowLink, ClusterIcon, EmptyState, Meter, PageBand, SectionHeader } from '../components/ui'

type Session = { title: string; exam: ExamId; questions: Question[]; timeLimitSec?: number; explanations: boolean }

const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5)
/** Same order for everyone on a given day. */
const daily = (qs: Question[]) => {
  const day = Math.floor(Date.now() / 86400000)
  return [...qs].sort((a, b) => ((a.id.charCodeAt(a.id.length - 1) * day) % 7) - ((b.id.charCodeAt(b.id.length - 1) * day) % 7)).slice(0, 10)
}

export default function Play() {
  const { me, isGuest, record } = useStore()
  const { event, exam } = useMyEvent()
  const [params, setParams] = useSearchParams()
  const [session, setSession] = useState<Session | null>(null)
  const [result, setResult] = useState<{ r: QuizResult; delta: number } | null>(null)
  const highlight = (params.get('cluster') as ExamId | null) ?? null

  const progress = me!.progress
  const accuracyFor = (id: ExamId) => {
    const x = progress.byExam[id]
    return x && x.answered ? Math.round((x.correct / x.answered) * 100) : null
  }
  const attempted = EXAMS.filter((x) => (progress.byExam[x.id]?.answered ?? 0) > 0)
  const weakest = [...attempted].sort((a, b) => (accuracyFor(a.id) ?? 0) - (accuracyFor(b.id) ?? 0))[0]

  const MODES = [
    { key: 'daily', icon: CalendarCheck, title: 'Daily', body: `Today’s ${examOf(exam).name} set.`, make: (): Session => ({ title: 'Daily challenge', exam, questions: daily(questionsFor(exam)), explanations: true }) },
    { key: 'endless', icon: InfinityIcon, title: 'Endless', body: 'Keep going as long as you like.', make: (): Session => ({ title: 'Endless', exam, questions: shuffle([...questionsFor(exam), ...questionsFor(exam), ...questionsFor(exam)]), explanations: true }) },
    {
      key: 'weak',
      icon: Crosshair,
      title: 'Weak spots',
      body: weakest ? `Your lowest: ${weakest.name}.` : 'Answer some questions first so we can find them.',
      make: weakest ? (): Session => ({ title: 'Weak spots', exam: weakest.id, questions: shuffle(questionsFor(weakest.id)), explanations: true }) : null,
    },
    { key: 'sprint', icon: Timer, title: 'Sprint', body: 'Two minutes, no explanations.', make: (): Session => ({ title: 'Sprint', exam, questions: shuffle(questionsFor(exam)), timeLimitSec: 120, explanations: false }) },
  ] as const

  const start = (s: Session) => {
    setResult(null)
    setSession(s)
  }
  const fullExam = (id: ExamId): Session => {
    const qs = shuffle(questionsFor(id))
    return { title: `${examOf(id).name} exam`, exam: id, questions: qs, timeLimitSec: qs.length * 60, explanations: false }
  }

  const mode = params.get('mode')
  useEffect(() => {
    if (!mode) return
    setParams({}, { replace: true })
    const m = MODES.find((x) => x.key === mode)
    if (m?.make) start(m.make())
    if (mode === 'exam') start(fullExam(exam))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const finish = (r: QuizResult) => {
    if (!session) return
    const delta = record({ title: session.title, exam: session.exam, total: r.total, correct: r.correct, seconds: r.seconds, wrongIds: r.wrongIds })
    setResult({ r, delta })
  }

  if (session && result)
    return (
      <ResultCard
        r={result.r}
        delta={result.delta}
        title={session.title}
        note={isGuest ? 'Guest progress stays on this device. Create an account to save it and join the leaderboard.' : undefined}
        onAgain={() => start({ ...session, questions: shuffle(session.questions) })}
        onDone={() => { setSession(null); setResult(null) }}
      />
    )
  if (session)
    return <QuizRunner title={session.title} questions={session.questions} timeLimitSec={session.timeLimitSec} showExplanations={session.explanations} onFinish={finish} onExit={() => setSession(null)} />

  const myExam = examOf(exam)
  const myAcc = accuracyFor(exam)
  const ordered = [myExam, ...EXAMS.filter((x) => x.id !== exam)]

  return (
    <div>
      <PageBand tag={event.code} title="Play" description={`Practicing for ${event.name}. Your event uses the ${myExam.name} exam.`} />

      <section className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map(({ key, icon: Icon, title, body, make }) => (
          <button
            key={key}
            disabled={!make}
            onClick={() => make && start(make())}
            className="group flex flex-col items-start bg-white p-6 text-left transition-colors hover:bg-tint disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Icon size={28} className={make ? 'text-brand' : 'text-line-strong'} />
            <span className={`mt-4 text-lg font-semibold tracking-head ${make ? 'text-ink' : 'text-ink-3'}`}>{title}</span>
            <span className="mt-1 text-sm text-ink-3">{body}</span>
            {make && <span className="mt-5 text-[13px] font-semibold tracking-label text-brand group-hover:underline">Start</span>}
          </button>
        ))}
      </section>

      <section className="mt-16">
        <SectionHeader title="Your exam" />
        <div className="grid lg:grid-cols-[1fr_1.4fr]">
          <div className="p-8" style={{ background: myExam.color, color: myExam.fg }}>
            <p className="text-[11px] font-bold uppercase tracking-label opacity-90">{event.code}, {event.type}</p>
            <h3 className="mt-3 text-3xl" style={{ color: myExam.fg }}>{myExam.name}</h3>
            <p className="num mt-6 text-5xl font-extrabold">{myAcc ?? 0}%</p>
            <p className="mt-1 text-sm opacity-90">accuracy over {progress.byExam[exam]?.answered ?? 0} questions</p>
          </div>
          <div className="flex flex-col justify-between gap-6 border border-line p-8 lg:border-l-0">
            <div>
              <p className="text-sm leading-relaxed text-ink-2">
                Take the full {myExam.name} practice set under exam conditions: one minute per question, no explanations until the end.
              </p>
              <p className="mt-3 text-sm text-ink-3">{questionsFor(exam).length} sample questions available now. The full bank arrives with the next update.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary btn-lg" onClick={() => start(fullExam(exam))}>Start exam</button>
              <Link to="/me" className="btn-secondary btn-lg">Change event</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-16">
        <SectionHeader title="Assigned to you" />
        <div className="panel">
          <EmptyState icon={<ClipboardText size={20} />} title="Nothing assigned yet" body="When a trainer in your chapter assigns a test or flashcard set, it shows up here." />
        </div>
      </section>

      <section className="mt-16">
        <SectionHeader title="Every DECA exam" />
        <ul className="divide-y divide-line border border-line">
          {ordered.map((x) => {
            const acc = accuracyFor(x.id)
            const hl = highlight === x.id
            return (
              <li key={x.id} className={`flex items-center gap-4 px-5 py-4 ${hl ? 'bg-tint' : ''}`}>
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-soft" style={{ background: x.color, color: x.fg }}>
                  {x.id === 'bac' ? <FileText size={20} /> : <ClusterIcon id={x.id as Exclude<ExamId, 'bac'>} size={20} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">
                    {x.name}
                    {x.id === exam && <span className="badge ml-2">Your exam</span>}
                  </p>
                  <p className="text-xs text-ink-3">{questionsFor(x.id).length} sample questions</p>
                </div>
                <div className="hidden w-36 sm:block">
                  {acc === null ? (
                    <p className="text-right text-xs text-ink-3">Not started</p>
                  ) : (
                    <>
                      <p className="num mb-1 text-right text-xs text-ink-2">{acc}% accuracy</p>
                      <Meter value={acc} color={x.color} />
                    </>
                  )}
                </div>
                <ArrowLink onClick={() => start(fullExam(x.id))}>Take</ArrowLink>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
