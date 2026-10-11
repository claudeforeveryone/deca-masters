import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowCircleRight, CalendarCheck, Infinity as InfinityIcon, Timer } from '@phosphor-icons/react'
import { EXAMS, examOf, type ExamId } from '../data/events'
import { loadQuestions, loadQuestionsById, questionCount, sample, shuffle, type Question } from '../data/questions'
import { clearActive, loadActive, saveActive } from '../data/activeSession'
import { useMyEvent, useStore, type Assignment } from '../store'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'
import { ArrowLink, Meter, PageBand, SectionHeader } from '../components/ui'
import AssignedToYou from '../components/Assigned'

type Session = { title: string; exam: ExamId; questions: Question[]; timeLimitSec?: number; explanations: boolean; unranked?: boolean; startedAt?: number; answers?: (number | null)[]; assignmentId?: string }

/** Swaps in any question text the trainer rewrote in the test builder. */
const withEdits = (qs: Question[], a?: Assignment) => (a?.edits ? qs.map((q) => (a.edits![q.id] ? { ...q, prompt: a.edits![q.id] } : q)) : qs)

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
  const { me, isGuest, record, myAssignments, completeAssignment } = useStore()
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
    saveActive(userId, { kind: 'play', title: s.title, exam: s.exam, questionIds: s.questions.map((q) => q.id), answers: started.answers, startedAt: started.startedAt, timeLimitSec: s.timeLimitSec, explanations: s.explanations, unranked: s.unranked, assignmentId: s.assignmentId })
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
        const ordered = a.questionIds.map((id) => byId.get(id)).filter((q): q is Question => !!q)
        const questions = withEdits(ordered, myAssignments.find((x) => x.id === a.assignmentId))
        if (questions.length !== a.questionIds.length) clearActive(userId, 'play')
        else setSession({ title: a.title, exam: a.exam, questions, timeLimitSec: a.timeLimitSec, explanations: a.explanations, unranked: a.unranked, startedAt: a.startedAt, answers: a.answers, assignmentId: a.assignmentId })
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
    { key: 'daily', icon: CalendarCheck, title: 'Daily', body: dailyDone ? 'Done for today. Replays are practice only.' : 'Counts toward your ELO.', make: (qs: Question[]): Session => ({ title: 'Daily challenge', exam, questions: daily(qs), explanations: true, unranked: dailyDone }) },
    { key: 'endless', icon: InfinityIcon, title: 'Endless', body: 'An explanation after every answer. Stop whenever you like.', make: (qs: Question[]): Session => ({ title: 'Endless', exam, questions: sample(qs, 200), explanations: true }) },
    {
      key: 'weak',
      icon: null,
      title: 'Weak spots',
      body: weakest ? `20 questions from ${weakest.name}, your lowest exam at ${accuracyFor(weakest.id)}%.` : 'Unlocks after your first session: it drills the exam you miss most.',
      exam: weakest?.id,
      make: weakest ? (qs: Question[]): Session => ({ title: 'Weak spots', exam: weakest.id, questions: sample(qs, 20), explanations: true }) : null,
    },
    { key: 'sprint', icon: Timer, title: 'Sprint', body: 'Two minutes on the clock and no explanations. Answer as many as you can.', make: (qs: Question[]): Session => ({ title: 'Sprint', exam, questions: sample(qs, 60), timeLimitSec: 120, explanations: false }) },
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
  /** Chapter tests run under exam conditions: one minute a question, no explanations, scored out of every question. */
  const startAssignment = async (a: Assignment) => {
    setError(null)
    setLoading(`assignment-${a.id}`)
    try {
      const n = a.count ?? 20
      const ids = a.type === 'Test' ? a.questionIds : undefined
      const picked = ids?.length ? withEdits(await loadQuestionsById(ids).then((qs) => ids.map((id) => qs.find((q) => q.id === id)).filter((q): q is Question => !!q)), a) : sample(await loadQuestions(a.exam), n)
      begin({ title: a.title, exam: a.exam, questions: picked, timeLimitSec: picked.length * 60, explanations: false, assignmentId: a.id })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(null)
    }
  }
  const startMode = (m: (typeof MODES)[number]) => m.make && start(m.key, ('exam' in m && m.exam) || exam, m.make)
  const startExam = (id: ExamId) => start(`exam-${id}`, id, fullExam)

  const mode = params.get('mode')
  const assignmentParam = params.get('assignment')
  useEffect(() => {
    if (!mode && !assignmentParam) return
    setParams({}, { replace: true })
    if (loadActive(userId, 'play')) return // finish the session in progress first
    const m = MODES.find((x) => x.key === mode)
    if (m) startMode(m)
    if (mode === 'exam') startExam(exam)
    const a = myAssignments.find((x) => x.id === assignmentParam && x.type !== 'Flashcards')
    if (a && !a.results?.[userId]) startAssignment(a)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, assignmentParam])

  // A cluster tile on Home opens Play scrolled to that exam's row.
  const listed = !session && !resuming
  useEffect(() => {
    if (highlight && listed) document.getElementById(`exam-${highlight}`)?.scrollIntoView({ block: 'center' })
  }, [highlight, listed])

  const finish = (r: QuizResult) => {
    if (!session) return
    clearActive(userId, 'play')
    const delta = record({ title: session.title, exam: session.exam, total: r.total, correct: r.correct, seconds: r.seconds, wrongIds: r.wrongIds, unranked: session.unranked })
    if (session.assignmentId) completeAssignment(session.assignmentId, { correct: r.correct, total: r.total })
    setResult({ r, delta })
  }

  if (session && result)
    return (
      <ResultCard
        r={result.r}
        delta={result.delta}
        title={session.unranked ? `${session.title} (practice)` : session.title}
        note={session.assignmentId ? 'Your score was saved to the assignment, so your trainer can see it.' : session.unranked ? 'Practice on questions you have already seen does not change your ELO.' : isGuest ? 'Guest progress stays on this device. Create an account to save it and join the leaderboard.' : undefined}
        onAgain={() => begin({ ...session, questions: shuffle(session.questions), unranked: true, assignmentId: undefined })}
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
        countUnanswered={!!session.assignmentId}
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
  const [dailyMode, endless, weak, sprint] = MODES
  // The daily set changes at midnight UTC (see `daily`).
  const left = 86400000 - (Date.now() % 86400000)
  const nextDaily = `${Math.floor(left / 3600000)}h ${Math.floor((left % 3600000) / 60000)}m`
  // Open chapter work goes near the top of the page so it is hard to miss.
  const hasOpen = myAssignments.some((a) => !a.results?.[userId])
  const assignedSection = (
    <section className="mt-16">
      <SectionHeader title="Assigned to you" action={myAssignments.length ? <ArrowLink to="/chapter">Chapter</ArrowLink> : undefined} />
      {loading?.startsWith('assignment-') && <p className="mb-3 text-sm text-ink-3">Loading questions…</p>}
      <AssignedToYou />
    </section>
  )

  return (
    <div>
      <PageBand tag={event.code} title="Play" description={`${event.name} uses the ${myExam.name} exam. Every mode below draws from its ${questionCount(exam).toLocaleString()} questions.`} />

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* The daily changes every day and is the same for everyone, so it leads. */}
        <div className="diamond-pattern flex flex-col rounded-box bg-navy-midnight p-7 text-white sm:p-9">
          <div className="flex items-center justify-between gap-4">
            <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-label text-tint-3">
              <CalendarCheck size={18} weight="bold" /> Daily challenge
            </span>
            <span className="num text-xs text-white/70">New set in {nextDaily}</span>
          </div>
          <p className="mt-8 flex items-baseline gap-3">
            <span className="num text-7xl font-extrabold leading-none tracking-head">10</span>
            <span className="text-lg font-semibold">questions</span>
          </p>
          <p className="mt-3 max-w-[40ch] text-sm leading-relaxed text-white/80">
            The same {myExam.name} set for every player today. {dailyMode.body}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-8">
            <button className="btn-white btn-lg" disabled={!!loading} onClick={() => startMode(dailyMode)}>
              {loading === 'daily' ? 'Loading questions…' : dailyDone ? 'Replay as practice' : 'Play daily'}
            </button>
            {dailyDone && <span className="text-sm font-semibold text-tint-3">Done today</span>}
          </div>
        </div>

        <div className="flex flex-col divide-y divide-line border border-line">
          {[endless, sprint].map((m) => {
            const Icon = m.icon
            return (
              <button key={m.key} disabled={!!loading} onClick={() => startMode(m)} className="group flex flex-1 items-center gap-5 p-6 text-left transition-colors hover:bg-tint disabled:cursor-wait sm:p-7">
                <Icon size={32} className="shrink-0 text-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xl font-semibold tracking-head text-ink">{m.title}</span>
                  <span className="mt-1 block text-sm text-ink-3">{m.body}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2 text-[13px] font-semibold tracking-label text-brand">
                  <span className="hidden sm:inline">{loading === m.key ? 'Loading…' : 'Start'}</span>
                  <ArrowCircleRight size={22} weight="fill" className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            )
          })}
          {weak.make ? (
            <button disabled={!!loading} onClick={() => startMode(weak)} className="group flex items-center gap-5 p-6 text-left transition-colors hover:bg-tint disabled:cursor-wait sm:p-7">
              <span className="h-8 w-8 shrink-0 rounded-soft" style={{ background: examOf(weak.exam!).color }} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-xl font-semibold tracking-head text-ink">{weak.title}</span>
                <span className="mt-1 block text-sm text-ink-3">{weak.body}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2 text-[13px] font-semibold tracking-label text-brand">
                <span className="hidden sm:inline">{loading === 'weak' ? 'Loading…' : 'Start'}</span>
                <ArrowCircleRight size={22} weight="fill" className="transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ) : (
            <p className="bg-canvas px-6 py-4 text-sm text-ink-3 sm:px-7">
              <span className="font-semibold text-ink-2">{weak.title}</span>. {weak.body}
            </p>
          )}
        </div>
      </section>
      {error && <p role="alert" className="mt-4 text-sm text-bad">{error}. Check your connection and try again.</p>}

      {hasOpen && assignedSection}

      <section className="mt-16">
        <SectionHeader title="Your exam" action={<Link to="/settings?tab=events" className="link text-sm">Change event</Link>} />
        <div className="grid overflow-hidden rounded-box border border-line md:grid-cols-[18rem_minmax(0,1fr)]">
          <div className="flex flex-col justify-between gap-8 p-7" style={{ background: myExam.color, color: myExam.fg }}>
            <p className="text-[11px] font-bold uppercase tracking-label opacity-90">{event.code}, {event.type}</p>
            <div>
              <p className="num text-6xl font-extrabold leading-none">{myAcc ?? 0}%</p>
              <p className="mt-2 text-sm opacity-90">accuracy over {progress.byExam[exam]?.answered ?? 0} questions</p>
            </div>
          </div>
          <div className="flex flex-col gap-6 p-7">
            <h3 className="text-2xl">{myExam.name}</h3>
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-box border border-line bg-line">
              {[
                ['Questions', String(EXAM_LENGTH)],
                ['Time', `${EXAM_LENGTH} min`],
                ['Answers', 'At the end'],
              ].map(([k, v]) => (
                <div key={k} className="bg-white px-4 py-3">
                  <dt className="text-[11px] font-bold uppercase tracking-label text-ink-3">{k}</dt>
                  <dd className="num mt-1 text-sm font-semibold text-ink sm:text-base">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="text-sm text-ink-3">
              Drawn from {questionCount(exam).toLocaleString()} past DECA questions, under competition conditions. <Link to={`/bank?exam=${exam}`} className="link">Browse the bank</Link>
            </p>
            <div>
              <button className="btn-primary btn-lg" disabled={!!loading} onClick={() => startExam(exam)}>{loading === `exam-${exam}` ? 'Loading questions…' : 'Start the exam'}</button>
            </div>
          </div>
        </div>
      </section>

      {!hasOpen && assignedSection}

      <section className="mt-16">
        <SectionHeader title="Every DECA exam" />
        <ul className="divide-y divide-line border border-line">
          {ordered.map((x) => {
            const acc = accuracyFor(x.id)
            const hl = highlight === x.id
            return (
              <li key={x.id} id={`exam-${x.id}`} className={`relative flex items-center gap-4 py-4 pl-6 pr-5 ${hl ? 'bg-tint' : ''}`}>
                <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: x.color }} aria-hidden />
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
