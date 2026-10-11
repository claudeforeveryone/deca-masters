import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MagnifyingGlass, CheckCircle, Lightning, BookOpen } from '@phosphor-icons/react'
import { EXAMS, examOf, type ExamId } from '../data/events'
import { questionCount, sample, useQuestions, type Question } from '../data/questions'
import { useMyEvent, useStore } from '../store'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'
import { EmptyState, PageBand } from '../components/ui'

const PAGE = 25
const QUIZ_SIZE = 20

/** Every question in each cluster's bank, browsable and searchable. */
export default function Bank() {
  const { exam: myExam } = useMyEvent()
  const { record } = useStore()
  const [params, setParams] = useSearchParams()
  const exam = (EXAMS.some((x) => x.id === params.get('exam')) ? params.get('exam') : myExam) as ExamId
  const { questions, error } = useQuestions(exam)
  const [query, setQuery] = useState('')
  const [area, setArea] = useState('all')
  const [shown, setShown] = useState(PAGE)
  const [open, setOpen] = useState<Set<string>>(new Set())
  const [quiz, setQuiz] = useState<Question[] | null>(null)
  const [result, setResult] = useState<{ r: QuizResult; delta: number } | null>(null)

  const pick = (id: ExamId) => {
    setParams({ exam: id }, { replace: true })
    setArea('all')
    setShown(PAGE)
    setOpen(new Set())
  }

  const areas = useMemo(() => {
    const n = new Map<string, number>()
    questions?.forEach((x) => n.set(x.area, (n.get(x.area) ?? 0) + 1))
    return [...n.entries()].sort((a, b) => b[1] - a[1])
  }, [questions])

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    return (questions ?? []).filter((x) => {
      if (area !== 'all' && x.area !== area) return false
      if (!words.length) return true
      const text = `${x.prompt} ${x.choices.join(' ')}`.toLowerCase()
      return words.every((w) => text.includes(w))
    })
  }, [questions, query, area])

  const toggle = (id: string) => setOpen((o) => {
    const n = new Set(o)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    return n
  })

  const info = examOf(exam)

  if (quiz && result)
    return <ResultCard r={result.r} delta={result.delta} title={`${info.name} quiz`} note={'Bank quizzes are practice, since the answers are on this page. They do not change your ELO.'} onAgain={() => { setResult(null); setQuiz(sample(filtered, QUIZ_SIZE)) }} onDone={() => { setQuiz(null); setResult(null) }} />
  if (quiz)
    return (
      <QuizRunner
        title={`${info.name} quiz`}
        questions={quiz}
        onFinish={(r) => setResult({ r, delta: record({ title: `${info.name} quiz`, exam, total: r.total, correct: r.correct, seconds: r.seconds, wrongIds: r.wrongIds, unranked: true }) })}
        onExit={() => setQuiz(null)}
      />
    )

  return (
    <div>
      <PageBand tag="Study" title="Question bank" description="Every question from past DECA cluster exams, sorted by cluster. Search them, filter by instructional area, and check the answer and explanation for each one." />

      <div className="mb-8 flex flex-wrap gap-2" role="tablist" aria-label="Cluster exam">
        {EXAMS.map((x) => {
          const on = x.id === exam
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={on}
              onClick={() => pick(x.id)}
              className="rounded-soft border-2 px-3 py-1.5 text-[13px] font-semibold transition-colors"
              style={on ? { background: x.color, borderColor: x.color, color: x.fg } : { borderColor: '#E4E4E4', color: '#333333' }}
            >
              {x.name} <span className="num ml-1 opacity-75">{questionCount(x.id).toLocaleString()}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,260px)_auto]">
        <label className="relative block">
          <span className="sr-only">Search questions</span>
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="input pl-9" placeholder={`Search ${info.name} questions`} value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE) }} />
        </label>
        <label className="block">
          <span className="sr-only">Instructional area</span>
          <select className="input" value={area} onChange={(e) => { setArea(e.target.value); setShown(PAGE) }}>
            <option value="all">All instructional areas</option>
            {areas.map(([a, n]) => <option key={a} value={a}>{a} ({n})</option>)}
          </select>
        </label>
        <button className="btn-primary" disabled={!filtered.length} onClick={() => { setResult(null); setQuiz(sample(filtered, QUIZ_SIZE)) }}>
          <Lightning size={16} /> Quiz me on these
        </button>
      </div>

      <p className="num mb-4 mt-6 text-sm text-ink-3" aria-live="polite">
        {questions ? `${filtered.length.toLocaleString()} of ${questions.length.toLocaleString()} questions` : error ? '' : 'Loading questions…'}
      </p>

      {error ? (
        <div className="panel"><EmptyState icon={<BookOpen size={20} />} title="Could not load this bank" body={`${error}. Check your connection and try again.`} /></div>
      ) : questions && filtered.length === 0 ? (
        <div className="panel"><EmptyState icon={<MagnifyingGlass size={20} />} title="No matching questions" body="Try different words or another instructional area." /></div>
      ) : (
        <ol className="divide-y divide-line border border-line empty:hidden">
          {filtered.slice(0, shown).map((q, i) => {
            const isOpen = open.has(q.id)
            return (
              <li key={q.id} className="px-5 py-5">
                <div className="flex gap-3">
                  <span className="num w-8 shrink-0 pt-px text-sm font-semibold text-ink-3">{i + 1}.</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold uppercase tracking-label text-ink-3">{q.area}{q.set ? `, ${q.set}` : ''}</p>
                    <p className="mt-1 text-[15px] text-ink">{q.prompt}</p>
                    <ul className="mt-3 grid gap-1.5 text-sm">
                      {q.choices.map((c, k) => {
                        const right = isOpen && k === q.answer
                        return (
                          <li key={k} className={`flex gap-2 ${right ? 'font-semibold text-good' : 'text-ink-2'}`}>
                            <span className="w-4 shrink-0 font-semibold">{'ABCD'[k]}.</span>
                            <span className="flex-1">{c}</span>
                            {right && <CheckCircle size={18} weight="fill" className="shrink-0" />}
                          </li>
                        )
                      })}
                    </ul>
                    {isOpen && q.explanation && <p className="mt-3 rounded-r-box border-l-4 border-brand bg-canvas p-4 text-sm leading-relaxed text-ink-2">{q.explanation}</p>}
                    <button className="link mt-3 text-[13px]" onClick={() => toggle(q.id)} aria-expanded={isOpen}>{isOpen ? 'Hide answer' : 'Show answer'}</button>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      )}

      {filtered.length > shown && (
        <div className="mt-6 flex justify-center">
          <button className="btn-secondary" onClick={() => setShown(shown + PAGE * 2)}>Show more</button>
        </div>
      )}
    </div>
  )
}
