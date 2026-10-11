import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle, XCircle, MinusCircle } from '@phosphor-icons/react'
import { examOf } from '../data/events'
import { LEVELS, examById, examTitle, loadExam, PAST_EXAMS } from '../data/exams'
import type { Question } from '../data/questions'
import { clearActive, loadActive, saveActive } from '../data/activeSession'
import { useStore } from '../store'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'
import { EmptyState, PageBand, Toggle } from '../components/ui'

const SECONDS_PER_QUESTION = 60

type Run = { questions: Question[]; startedAt: number; answers: (number | null)[]; timeLimitSec?: number; explanations: boolean; unranked: boolean }

export default function ExamTake() {
  const { id = '' } = useParams()
  const exam = examById(id)
  const { me, isGuest, record } = useStore()
  const userId = me!.id
  const [timed, setTimed] = useState(true)
  const [explain, setExplain] = useState(false)
  const [run, setRun] = useState<Run | null>(null)
  const [result, setResult] = useState<{ r: QuizResult; delta: number; answers: (number | null)[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reviewAll, setReviewAll] = useState(false)
  const answersRef = useRef<(number | null)[]>([])

  const taken = me!.progress.history.some((h) => h.pastExam === id)
  const active = loadActive(userId, 'exam')
  const otherInProgress = active && active.pastExam !== id ? PAST_EXAMS.find((x) => x.id === active.pastExam) : undefined

  // Resume this exam if you left it part way.
  useEffect(() => {
    if (!exam) return
    const a = loadActive(userId, 'exam')
    if (!a || a.pastExam !== id) return
    loadExam(exam).then((qs) => {
      const byId = new Map(qs.map((q) => [q.id, q]))
      const questions = a.questionIds.map((qid) => byId.get(qid)).filter((q): q is Question => !!q)
      if (questions.length !== a.questionIds.length) return clearActive(userId, 'exam')
      answersRef.current = a.answers
      setRun({ questions, startedAt: a.startedAt, answers: a.answers, timeLimitSec: a.timeLimitSec, explanations: a.explanations, unranked: !!a.unranked })
    }, () => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId])

  if (!exam)
    return (
      <div className="pt-12">
        <EmptyState icon={<MinusCircle size={20} />} title="Exam not found" body="It may have been renamed." action={<Link to="/exams" className="btn-primary">All exams</Link>} />
      </div>
    )

  const info = examOf(exam.cluster)
  const title = `${info.name}, ${examTitle(exam)}`

  const start = async () => {
    setError(null)
    setLoading(true)
    try {
      const questions = await loadExam(exam)
      const startedAt = Date.now()
      const answers = questions.map(() => null)
      const timeLimitSec = timed ? questions.length * SECONDS_PER_QUESTION : undefined
      // Only your first attempt at an exam is ranked; after that you have seen the answers.
      const unranked = taken
      saveActive(userId, { kind: 'exam', title, exam: exam.cluster, questionIds: questions.map((q) => q.id), answers, startedAt, timeLimitSec, explanations: explain, unranked, pastExam: exam.id })
      answersRef.current = answers
      setResult(null)
      setRun({ questions, startedAt, answers, timeLimitSec, explanations: explain, unranked })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const finish = (r: QuizResult) => {
    if (!run) return
    clearActive(userId, 'exam')
    const delta = record({ title, exam: exam.cluster, total: r.total, correct: r.correct, seconds: r.seconds, wrongIds: r.wrongIds, unranked: run.unranked, pastExam: exam.id })
    setResult({ r, delta, answers: answersRef.current })
  }

  if (run && result) {
    const rows = run.questions.map((q, i) => ({ q, i, picked: result.answers[i] ?? null }))
    const missed = rows.filter((x) => x.picked !== null && x.picked !== x.q.answer)
    const list = reviewAll ? rows : missed
    return (
      <div className="pb-8">
        <ResultCard
          r={result.r}
          delta={result.delta}
          title={title}
          note={run.unranked ? 'Retakes are practice, so they do not change your ELO.' : isGuest ? 'Guest progress stays on this device.' : undefined}
          onAgain={start}
          onDone={() => { setRun(null); setResult(null) }}
        />
        <section className="mx-auto mt-12 max-w-3xl">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
            <h2 className="h-section">Review</h2>
            <div className="flex gap-2">
              <button className={!reviewAll ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setReviewAll(false)}>Missed ({missed.length})</button>
              <button className={reviewAll ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'} onClick={() => setReviewAll(true)}>All ({rows.length})</button>
            </div>
          </div>
          {list.length === 0 ? (
            <div className="panel"><EmptyState icon={<CheckCircle size={20} />} title="Nothing missed" body="Every question you answered was right." /></div>
          ) : (
            <ol className="divide-y divide-line border border-line">
              {list.map(({ q, i, picked }) => (
                <li key={q.id} className="px-5 py-5">
                  <p className="num text-[11px] font-bold uppercase tracking-label text-ink-3">Question {i + 1}{q.area !== 'General' ? `, ${q.area}` : ''}</p>
                  <p className="mt-1 text-[15px] text-ink">{q.prompt}</p>
                  <ul className="mt-3 grid gap-1.5 text-sm">
                    {q.choices.map((c, k) => {
                      const right = k === q.answer
                      const wrongPick = k === picked && !right
                      return (
                        <li key={k} className={`flex gap-2 ${right ? 'font-semibold text-good' : wrongPick ? 'text-bad line-through' : 'text-ink-2'}`}>
                          <span className="w-4 shrink-0 font-semibold">{'ABCD'[k]}.</span>
                          <span className="flex-1">{c}</span>
                          {right && <CheckCircle size={18} weight="fill" className="shrink-0" />}
                          {wrongPick && <XCircle size={18} weight="fill" className="shrink-0" />}
                        </li>
                      )
                    })}
                  </ul>
                  {picked === null && <p className="mt-2 text-xs text-ink-3">Not answered</p>}
                  {q.explanation && <p className="mt-3 rounded-r-box border-l-4 border-brand bg-canvas p-4 text-sm leading-relaxed text-ink-2">{q.explanation}</p>}
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    )
  }

  if (run)
    return (
      <QuizRunner
        key={run.startedAt}
        title={run.unranked ? `${title} (practice)` : title}
        questions={run.questions}
        timeLimitSec={run.timeLimitSec}
        showExplanations={run.explanations}
        startedAt={run.startedAt}
        initialAnswers={run.answers}
        onAnswer={(answers) => {
          answersRef.current = answers
          const a = loadActive(userId, 'exam')
          if (a) saveActive(userId, { ...a, answers })
        }}
        onFinish={finish}
        onExit={() => { clearActive(userId, 'exam'); setRun(null) }}
      />
    )

  return (
    <div>
      <PageBand tag={`${info.name}`} title={examTitle(exam)} description={exam.test ? `DECA test ${exam.test}. ${LEVELS[exam.level].blurb}.` : `${LEVELS[exam.level].blurb}.`}>
        <Link to={`/exams?cluster=${exam.cluster}`} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-white/90 hover:text-white">
          <ArrowLeft size={16} /> All {info.name} exams
        </Link>
      </PageBand>

      <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[1fr_300px]">
        <section className="rounded-box border border-line p-6 sm:p-8">
          <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-box border border-line bg-line">
            {[
              ['Questions', String(exam.count)],
              ['Time', timed ? `${exam.count} min` : 'Untimed'],
              ['Explanations', explain ? 'As you go' : 'At the end'],
            ].map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-3">
                <dt className="text-[11px] font-bold uppercase tracking-label text-ink-3">{k}</dt>
                <dd className="num mt-1 text-sm font-semibold text-ink sm:text-base">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 divide-y divide-line">
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-semibold text-ink">Timed</p>
                <p className="text-xs text-ink-3">One minute per question, like competition day.</p>
              </div>
              <Toggle on={timed} onChange={setTimed} label="Timed" />
            </div>
            <div className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm font-semibold text-ink">Show explanations as you go</p>
                <p className="text-xs text-ink-3">Off: see every answer and explanation in the review at the end.</p>
              </div>
              <Toggle on={explain} onChange={setExplain} label="Show explanations as you go" />
            </div>
          </div>

          {otherInProgress ? (
            <p className="mt-6 rounded-box bg-canvas p-4 text-sm text-ink-2">
              Finish the exam you already started first:{' '}
              <Link to={`/exams/${otherInProgress.id}`} className="link">{examOf(otherInProgress.cluster).name}, {examTitle(otherInProgress)}</Link>
            </p>
          ) : (
            <button className="btn-primary btn-lg mt-6 w-full sm:w-auto" disabled={loading} onClick={start}>
              {loading ? 'Loading questions…' : taken ? 'Retake as practice' : 'Start the exam'}
            </button>
          )}
          {error && <p role="alert" className="mt-3 text-sm text-bad">{error}. Check your connection and try again.</p>}
        </section>

        <aside className="space-y-4 text-sm text-ink-2">
          <p><span className="font-semibold text-ink">Your first attempt is ranked.</span> It counts toward your ELO and accuracy. Retakes are practice.</p>
          <p>Leaving the page keeps your place, and the clock keeps running. Ending early scores the questions you answered.</p>
          {exam.explained < exam.count * 0.8 && <p>Some questions in this booklet came without explanations, so the review shows just the right answer for those.</p>}
        </aside>
      </div>
    </div>
  )
}
