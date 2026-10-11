import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarCheck, Infinity as InfinityIcon, Crosshair, Timer, FileText, ClipboardText } from '@phosphor-icons/react'
import { EXAMS, examOf, type ExamId } from '../data/events'
import { loadQuestions, loadQuestionsById, questionCount, sample, shuffle, type Question } from '../data/questions'
import { clearActive, loadActive, saveActive } from '../data/activeSession'
import { useMyEvent, useStore } from '../store'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'
import { ArrowLink, ClusterIcon, EmptyState, Meter, PageBand, SectionHeader } from '../components/ui'

type Session = { title: string; exam: ExamId; questions: Question[]; timeLimitSec?: number; explanations: boolean; unranked?: boolean; startedAt?: number; answers?: (number | null)[] }

const EXAM_LENGTH = 100 // DECA cluster exams have 100 questions
/** The same 10 questions for everyone on a given day. */
const daily = (qs: Question[]) => {
  let seed = Math.floor(Date.now() / 86400000)
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }
  const picked = new Set<number>()
  while (picked.size < Math.min(10, qs.length)) picked.add(Math.floor(rand() * qs.length))
  return [...picked].map((i) => qs[i])
}

export default function Play() {
  const { me, isGuest, record } = useStore()
  const { event, exam } = useMyEvent()
  const [params, setParams] = useSearchParams()
  const [session, setSession] = useState<Session | null>(null)
  const [result, setResult] = useState<{ r: QuizResult; delta: number } | null>(null)
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const highlight = (params.get('cluster') as ExamId | null) ?? null
  const userId = me!.id

  /** Starts a session and saves it, so leaving the page resumes it instead of re-rolling. */
  const begin = (s: Session) => {
    const started = { ...s, startedAt: Date.now(), answers: s.questions.map(() => null) }
    saveActive(userId, { kind: 'play', title: s.title, exam: s.exam, questionIds: s.questions.map((q) => q.id), answers: started.answers, startedAt: started.startedAt, timeLimitSec: s.timeLimitSec, explanations: s.explanations, unranked: s.unranked })
    setResult(null)
    setSession(started)
  }

  // Resume a session left in progress.
  const [resuming, setResuming] = useState(() => !!loadActive(userId, 'play'))
  useEffect(() => {
    const a = loadActive(userId, 'play')
    if (!a) return
    loadQuestionsById(a.questionIds).then(
      (qs) => {
        const byId = new Map(qs.map((q) => [q.id, q]))
        const questions = a.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q)
        if (questions.length !== a.questionIds.length) clearActive(userId, 'play')
        else setSession({ title: a.title, exam: a.exam, questions, timeLimitSec: a.timeLimitSec, explanations: a.explanations, unranked: a.unranked, startedAt: a.startedAt, answers: a.answers })
        setResuming(false)
      },
      () => setResuming(false),
    )
  }, [userId])

  const progress = me!.progress
  const accuracyFor = (id: ExamId) => {
    const x = progress.byExam[id]
    return x && x.answered ? Math.round((x.correct / x.answered) * 100) : null
  }
  const attempted = EXAMS.filter((x) => (progress.byExam[x.id]?.answered ?? 0) > 0)
  const weakest = [...attempted].sort((a, b) => (accuracyFor(a.id) ?? 0) - (accuracyFor(b.id) ?? 0))[0]

  // Only the first daily of the day on each exam is ranked; replays already know the answers.
  const today = new Date().toISOString().slice(0, 10)
  const dailyDone = progress.history.some((h) => h.title === 'Daily challenge' && h.exam === exam && !h.unranked && h.date.slice(0, 10) === today)
  const MODES = [
    { key: 'daily', icon: CalendarCheck, title: 'Daily', body: dailyDone ? 'Done for today. Replays are practice only.' : `Today’s ${examOf(exam).name} set.`, make: (qs: Question[]): Session => ({ title: 'Daily challenge', exam, questions: daily(qs), explanations: true, unranked: dailyDone }) },
    { key: 'endless', icon: InfinityIcon, title: 'Endless', body: 'Keep going as long as you like.', make: (qs: Question[]): Session => ({ title: 'Endless', exam, questions: sample(qs, 200), explanations: true }) },
    {
      key: 'weak',
      icon: Crosshair,
      title: 'Weak spots',
      body: weakest ? `Your lowest: ${weakest.name}.` : 'Answer some questions first so we can find them.',
      exam: weakest?.id,
      make: weakest ? (qs: Question[]): Session => ({ title: 'Weak spots', exam: weakest.id, questions: sample(qs, 20), explanations: true }) : null,
    },
    { key: 'sprint', icon: Timer, title: 'Sprint', body: 'Two minutes, no explanations.', make: (qs: Question[]): Session => ({ title: 'Sprint', exam, questions: sample(qs, 60), timeLimitSec: 120, explanations: false }) },
  ] as const

  /** Loads the exam's question bank, then starts the session built from it. */
  const start = async (key: string, id: ExamId, make: (qs: Question[]) => Session) => {
    setError(null)
    setLoading(key)
    try {
      begin(make(await loadQuestions(id)))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }
  const fullExam = (qs: Question[]): Session => {
    const picked = sample(qs, EXAM_LENGTH)
    return { title: `${examOf(qs[0].exam).name} exam`, exam: qs[0].exam, questions: picked, timeLimitSec: picked.length * 60, explanations: false }
  }
  const startMode = (m: (typeof MODES)[number]) => m.make && start(m.key, ('exam' in m && m.exam) || exam, m.make)
  const startExam = (id: ExamId) => start(`exam-${id}`, id, fullExam)

  const mode = params.get('mode')
  useEffect(() => {
    if (!mode) return
    setParams({}, { replace: true })
    if (loadActive(userId, 'play')) return // finish the session in progress first
    const m = MODES.find((x) => x.key === mode)
    if (m) startMode(m)
    if (mode === 'exam') startExam(exam)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  const finish = (r: QuizResult) => {
    if (!session) return
    clearActive(userId, 'play')
    const delta = record({ title: session.title, exam: session.exam, total: r.total, correct: r.correct, seconds: r.seconds, wrongIds: r.wrongIds, unranked: session.unranked })
    setResult({ r, delta })
  }

  if (session && result)
    return (
      <ResultCard
        r={result.r}
        delta={result.delta}
        title={session.unranked ? `${session.title} (practice)` : session.title}
        note={session.unranked ? 'Practice on questions you have already seen does not change your ELO.' : isGuest ? 'Guest progress stays on this device. Create an account to save it and join the leaderboard.' : undefined}
        onAgain={() => begin({ ...session, questions: shuffle(session.questions), unranked: true })}
        onDone={() => { setSession(null); setResult(null) }}
      />
    )
  if (session)
    return (
      <QuizRunner
        key={session.startedAt}
        title={session.unranked ? `${session.title} (practice)` : session.title}
        questions={session.questions}
        timeLimitSec={session.timeLimitSec}
        showExplanations={session.explanations}
        startedAt={session.startedAt}
        initialAnswers={session.answers}
        onAnswer={(answers) => { const a = loadActive(userId, 'play'); if (a) saveActive(userId, { ...a, answers }) }}
        onFinish={finish}
        onExit={() => { clearActive(userId, 'play'); setSession(null) }}
      />
    )
  if (resuming) return <p className="pt-16 text-center text-sm text-ink-3">Resuming your session…</p>

  const myExam = examOf(exam)
  const myAcc = accuracyFor(exam)
  const ordered = [myExam, ...EXAMS.filter((x) => x.id !== exam)]

  return (
    <div>
      <PageBand tag={event.code} title="Play" description={`Practicing for ${event.name}. Your event uses the ${myExam.name} exam.`} />

      <section className="grid gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
        {MODES.map((m) => {
          const { key, icon: Icon, title, body, make } = m
          return (
          <button
            key={key}
            disabled={!make || !!loading}
            onClick={() => startMode(m)}
            className="group flex flex-col items-start bg-white p-6 text-left transition-colors hover:bg-tint disabled:cursor-not-allowed disabled:hover:bg-white"
          >
            <Icon size={28} className={make ? 'text-brand' : 'text-line-strong'} />
            <span className={`mt-4 text-lg font-semibold tracking-head ${make ? 'text-ink' : 'text-ink-3'}`}>{title}</span>
            <span className="mt-1 text-sm text-ink-3">{body}</span>
            {make && <span className="mt-5 text-[13px] font-semibold tracking-label text-brand group-hover:underline">{loading === key ? 'Loading questions…' : 'Start'}</span>}
          </button>
          )
        })}
      </section>
      {error && <p role="alert" className="mt-4 text-sm text-bad">{error}. Check your connection and try again.</p>}

      <section className="mt-16">
        <SectionHeader title="Your exam" />
        <div className="grid lg:grid-cols-[1fr_1.4fr]">
          <div className="rounded-t-box p-8 lg:rounded-tr-none lg:rounded-bl-box" style={{ background: myExam.color, color: myExam.fg }}>
            <p className="text-[11px] font-bold uppercase tracking-label opacity-90">{event.code}, {event.type}</p>
            <h3 className="mt-3 text-3xl" style={{ color: myExam.fg }}>{myExam.name}</h3>
            <p className="num mt-6 text-5xl font-extrabold">{myAcc ?? 0}%</p>
            <p className="mt-1 text-sm opacity-90">accuracy over {progress.byExam[exam]?.answered ?? 0} questions</p>
          </div>
          <div className="flex flex-col justify-between gap-6 rounded-none rounded-b-box border border-line p-8 lg:rounded-r-box lg:rounded-bl-none lg:border-l-0">
            <div>
              <p className="text-sm leading-relaxed text-ink-2">
                Take a {EXAM_LENGTH}-question {myExam.name} exam drawn from past DECA exams, under exam conditions: one minute per question, no explanations until the end.
              </p>
              <p className="mt-3 text-sm text-ink-3">
                {questionCount(exam).toLocaleString()} questions in the {myExam.name} bank. <Link to={`/bank?exam=${exam}`} className="link">Browse them</Link>
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="btn-primary btn-lg" disabled={!!loading} onClick={() => startExam(exam)}>{loading === `exam-${exam}` ? 'Loading questions…' : 'Start exam'}</button>
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
                  <p className="text-xs text-ink-3">{questionCount(x.id).toLocaleString()} {x.id === 'pfl' ? 'sample ' : ''}questions</p>
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
                <ArrowLink onClick={() => startExam(x.id)}>{loading === `exam-${x.id}` ? 'Loading…' : 'Take'}</ArrowLink>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
