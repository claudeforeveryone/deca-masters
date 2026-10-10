import { useMemo, useState } from 'react'
import { Flame, Target, Clock, FileCheck2, Trophy, Award, Swords, RotateCcw, Pencil } from 'lucide-react'
import { ACHIEVEMENTS, EVENTS, ME, MY_STATS, PAST_EXAMS, PLAYERS, QUESTIONS, eventName } from '../data/mock'
import { Bar, PlayerRow, Sparkline, StatCard, Tabs } from '../components/ui'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'

const TABS = ['Stats', 'Career'] as const

export default function Me() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Stats')
  return (
    <div className="space-y-6">
      <ProfileHeader />
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
      {tab === 'Stats' ? <Stats /> : <Career />}
    </div>
  )
}

function ProfileHeader() {
  return (
    <section className="overflow-hidden rounded-3xl bg-white shadow-card">
      <div className="h-24 bg-gradient-to-r from-navy to-deca" />
      <div className="flex flex-wrap items-end gap-4 px-6 pb-6">
        <div className="relative -mt-12">
          <img src={ME.avatar} className="h-24 w-24 rounded-2xl ring-4 ring-white" alt="" />
          <button className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-deca text-white" title="Change photo">
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-extrabold">{ME.name}</h1>
          <p className="muted">{ME.school} · Grade {ME.grade} · {ME.chapter}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="chip">Main event: Marketing</span>
            <span className="chip">Rank #{MY_STATS.rank}</span>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold uppercase text-navy/50">ELO</p>
          <p className="text-4xl font-extrabold text-deca">{ME.elo}</p>
        </div>
      </div>
    </section>
  )
}

function Stats() {
  const myIdx = PLAYERS.findIndex((p) => p.id === ME.id)
  const around = PLAYERS.slice(Math.max(0, myIdx - 3), myIdx + 3)
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Global rank" value={`#${MY_STATS.rank}`} icon={<Trophy className="h-5 w-5" />} />
            <StatCard label="Accuracy" value={`${MY_STATS.accuracy}%`} icon={<Target className="h-5 w-5" />} />
            <StatCard label="Questions" value={MY_STATS.questionsDone.toLocaleString()} icon={<FileCheck2 className="h-5 w-5" />} />
            <StatCard label="Time spent" value={`${MY_STATS.timeSpentHrs}h`} icon={<Clock className="h-5 w-5" />} />
            <StatCard label="Streak" value={`${MY_STATS.streak}d`} icon={<Flame className="h-5 w-5" />} />
            <StatCard label="Best streak" value={`${MY_STATS.bestStreak}d`} icon={<Flame className="h-5 w-5" />} />
            <StatCard label="Best paper" value={`${MY_STATS.bestPaper.score}%`} sub={MY_STATS.bestPaper.name} />
            <StatCard label="Arena" value={`${MY_STATS.arenaRecord.w}–${MY_STATS.arenaRecord.l}`} icon={<Swords className="h-5 w-5" />} />
          </div>

          <div className="card p-5">
            <h2 className="section-title">Accuracy by section</h2>
            <ul className="mt-4 space-y-3">
              {MY_STATS.bySection.map((s) => {
                const e = EVENTS.find((x) => x.id === s.event)!
                return (
                  <li key={s.event} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[12rem_1fr_6rem_3rem]">
                    <span className="truncate font-medium">{e.name}</span>
                    <Bar value={s.accuracy} color={e.color} />
                    <span className="hidden text-xs text-navy/50 sm:inline">{s.done} done</span>
                    <span className="text-right font-bold">{s.accuracy}%</span>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="section-title">ELO over time</h2>
            <Sparkline data={MY_STATS.eloHistory} className="mt-3 h-36 w-full" />
          </div>
        </div>

        <div className="card h-fit p-5">
          <h2 className="section-title mb-2">Around you</h2>
          {around.map((p) => <PlayerRow key={p.id} p={p} rank={PLAYERS.indexOf(p) + 1} highlight={p.id === ME.id} />)}
        </div>
      </div>

      <div>
        <h2 className="section-title mb-3 flex items-center gap-2"><Award className="h-5 w-5 text-deca" /> Achievements</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.title} className="card flex items-start gap-4 p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sky-100 text-2xl">{a.icon}</span>
              <div>
                <p className="font-bold">{a.title}</p>
                <p className="muted">{a.desc}</p>
                <p className="mt-1 text-xs text-navy/40">{a.date}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

const CAREER_TABS = ['Past exams', 'Wrong answers'] as const
type SortKey = 'date' | 'accuracy' | 'time'

function Career() {
  const [tab, setTab] = useState<(typeof CAREER_TABS)[number]>('Past exams')
  const [sort, setSort] = useState<SortKey>('date')
  const [dir, setDir] = useState<1 | -1>(-1)
  const [eventFilter, setEventFilter] = useState('all')
  const [redo, setRedo] = useState<string[] | null>(null)
  const [result, setResult] = useState<QuizResult | null>(null)

  const exams = useMemo(() => {
    const val = (e: (typeof PAST_EXAMS)[number]) => (sort === 'accuracy' ? e.accuracy : sort === 'time' ? e.timeMin : +new Date(e.date))
    return [...PAST_EXAMS].sort((a, b) => (val(a) - val(b)) * dir)
  }, [sort, dir])

  const wrong = useMemo(() => {
    const ids = new Map<string, string>()
    PAST_EXAMS.forEach((e) => e.wrongIds.forEach((id) => ids.set(id, e.name)))
    return [...ids.entries()]
      .map(([id, from]) => ({ q: QUESTIONS.find((q) => q.id === id)!, from }))
      .filter((w) => eventFilter === 'all' || w.q.event === eventFilter)
  }, [eventFilter])

  if (redo && result) return <ResultCard r={result} onDone={() => { setRedo(null); setResult(null) }} />
  if (redo)
    return <QuizRunner title="Redo missed questions" questions={QUESTIONS.filter((q) => redo.includes(q.id))} onFinish={setResult} onExit={() => setRedo(null)} />

  const sortBtn = (k: SortKey, label: string) => (
    <button
      onClick={() => (sort === k ? setDir(dir === 1 ? -1 : 1) : (setSort(k), setDir(-1)))}
      className={`chip ${sort === k ? 'bg-deca text-white' : ''}`}
    >
      {label} {sort === k && (dir === -1 ? '↓' : '↑')}
    </button>
  )

  return (
    <div className="space-y-4">
      <Tabs tabs={CAREER_TABS} value={tab} onChange={setTab} />

      {tab === 'Past exams' ? (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-sky-100 p-4">
            <span className="muted mr-1">Sort by</span>
            {sortBtn('date', 'Date')}
            {sortBtn('accuracy', 'Accuracy')}
            {sortBtn('time', 'Time')}
          </div>
          <table className="w-full text-sm">
            <thead className="bg-sky-50 text-left text-xs uppercase tracking-wide text-navy/50">
              <tr><th className="px-4 py-2">Exam</th><th className="hidden px-4 py-2 sm:table-cell">Date</th><th className="px-4 py-2">Accuracy</th><th className="px-4 py-2">Time</th><th className="hidden px-4 py-2 sm:table-cell">ELO</th><th className="px-4 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {exams.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-3"><p className="font-semibold">{e.name}</p><p className="text-xs text-navy/50">{eventName(e.event)}</p></td>
                  <td className="hidden px-4 py-3 sm:table-cell">{e.date}</td>
                  <td className="px-4 py-3"><span className={`font-bold ${e.accuracy >= 80 ? 'text-green-600' : e.accuracy >= 70 ? 'text-deca' : 'text-red-500'}`}>{e.accuracy}%</span></td>
                  <td className="px-4 py-3">{e.timeMin} min</td>
                  <td className={`hidden px-4 py-3 font-semibold sm:table-cell ${e.eloDelta >= 0 ? 'text-green-600' : 'text-red-500'}`}>{e.eloDelta >= 0 ? '+' : ''}{e.eloDelta}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="text-xs font-semibold text-deca" onClick={() => setRedo(e.wrongIds)}>Redo misses</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <select className="input w-auto" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
                <option value="all">All events</option>
                {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <span className="muted">{wrong.length} questions</span>
            </div>
            <button className="btn-primary" disabled={!wrong.length} onClick={() => setRedo(wrong.map((w) => w.q.id))}>
              <RotateCcw className="h-4 w-4" /> Redo all
            </button>
          </div>
          <ul className="mt-4 space-y-3">
            {wrong.map(({ q, from }) => (
              <li key={q.id} className="rounded-xl border border-sky-100 p-4">
                <div className="flex items-center gap-2 text-xs text-navy/50"><span className="chip">{eventName(q.event)}</span> from {from}</div>
                <p className="mt-2 font-medium">{q.prompt}</p>
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-green-700">✓ {q.choices[q.answer]}</span>
                  <button className="text-xs font-semibold text-deca" onClick={() => setRedo([q.id])}>Redo</button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
