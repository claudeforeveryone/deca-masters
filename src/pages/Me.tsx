import { useMemo, useState } from 'react'
import { Trophy, Flame, Crosshair, Sword, BookOpenText, Lightning, Camera, ArrowCounterClockwise, CaretUp, CaretDown, CheckCircle } from '@phosphor-icons/react'
import { ACHIEVEMENTS, EVENTS, ME, MY_STATS, PAST_EXAMS, PLAYERS, QUESTIONS, eventName } from '../data/mock'
import { Avatar, EloChart, EmptyState, Meter, RankRow, Segmented, Stat } from '../components/ui'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'

const TABS = ['Overview', 'Career'] as const
const ACH_ICONS = { trophy: Trophy, flame: Flame, target: Crosshair, swords: Sword, book: BookOpenText, bolt: Lightning } as const

export default function Me() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview')
  return (
    <div className="space-y-8">
      <ProfileHeader />
      <Segmented options={TABS} value={tab} onChange={setTab} />
      <div key={tab} className="enter">{tab === 'Overview' ? <Overview /> : <Career />}</div>
    </div>
  )
}

function ProfileHeader() {
  return (
    <section className="flex flex-col gap-6 sm:flex-row sm:items-center">
      <div className="relative w-fit">
        <Avatar name={ME.name} size={80} />
        <button className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border border-line bg-white text-ink-2 shadow-sm hover:text-ink" aria-label="Change profile photo">
          <Camera size={15} />
        </button>
      </div>
      <div className="flex-1">
        <h1 className="text-2xl font-semibold sm:text-[28px]">{ME.name}</h1>
        <p className="mt-1 text-ink-3">{ME.school}, grade {ME.grade}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="badge">{ME.chapter}</span>
          <span className="badge-neutral">Main event: Marketing</span>
        </div>
      </div>
      <div className="flex gap-8 sm:text-right">
        <div>
          <p className="text-[13px] text-ink-3">ELO</p>
          <p className="num text-3xl font-semibold">{ME.elo.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-[13px] text-ink-3">Rank</p>
          <p className="num text-3xl font-semibold">#{MY_STATS.rank}</p>
        </div>
      </div>
    </section>
  )
}

function Overview() {
  const myIdx = PLAYERS.findIndex((p) => p.id === ME.id)
  const around = PLAYERS.slice(Math.max(0, myIdx - 2), myIdx + 3)
  const sections = [...MY_STATS.bySection].sort((a, b) => b.accuracy - a.accuracy)

  return (
    <div className="space-y-10">
      <section className="surface grid grid-cols-2 gap-6 p-5 sm:p-6 md:grid-cols-4">
        <Stat label="Accuracy" value={`${MY_STATS.accuracy}%`} />
        <Stat label="Questions" value={MY_STATS.questionsDone.toLocaleString()} />
        <Stat label="Time practiced" value={`${MY_STATS.timeSpentHrs}h`} />
        <Stat label="Arena record" value={`${MY_STATS.arenaRecord.w}-${MY_STATS.arenaRecord.l}`} />
        <Stat label="Current streak" value={`${MY_STATS.streak}d`} />
        <Stat label="Best streak" value={`${MY_STATS.bestStreak}d`} />
        <Stat label="Best exam" value={`${MY_STATS.bestPaper.score}%`} hint={MY_STATS.bestPaper.name} />
        <Stat label="Exams taken" value={PAST_EXAMS.length} hint="Full and practice" />
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <section>
            <h2 className="h-section mb-4">Accuracy by event</h2>
            <ul className="space-y-4">
              {sections.map((s) => (
                <li key={s.event} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[200px_1fr_100px]">
                  <span className="text-sm font-medium">{eventName(s.event)}</span>
                  <span className="num text-right text-sm sm:order-last">
                    {s.accuracy}% <span className="text-xs text-ink-3">of {s.done}</span>
                  </span>
                  <div className="col-span-2 sm:col-span-1"><Meter value={s.accuracy} /></div>
                </li>
              ))}
            </ul>
          </section>

          <section className="surface p-5 sm:p-6">
            <h2 className="h-section">ELO over time</h2>
            <div className="mt-5"><EloChart data={MY_STATS.eloHistory} height={160} /></div>
          </section>
        </div>

        <aside>
          <h2 className="h-section mb-3">Players near you</h2>
          <div className="surface p-2">
            {around.map((p) => <RankRow key={p.id} p={p} rank={PLAYERS.indexOf(p) + 1} me={p.id === ME.id} />)}
          </div>
        </aside>
      </div>

      <section>
        <h2 className="h-section mb-4">Achievements</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a, i) => {
            const Icon = ACH_ICONS[a.icon as keyof typeof ACH_ICONS]
            return (
              <li key={a.title} className={`flex items-start gap-4 rounded-xl p-4 ${i === 0 ? 'bg-ink text-white' : 'surface'}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${i === 0 ? 'bg-white/10 text-tint-3' : 'bg-tint text-brand'}`}>
                  <Icon size={20} weight="duotone" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{a.title}</p>
                  <p className={`mt-0.5 text-sm ${i === 0 ? 'text-white/65' : 'text-ink-3'}`}>{a.desc}</p>
                  <p className={`mt-2 text-xs ${i === 0 ? 'text-white/50' : 'text-ink-3'}`}>Earned {a.date}</p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

const CAREER_TABS = ['Past exams', 'Missed questions'] as const
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

  if (redo && result) return <ResultCard r={result} title="Review complete" onDone={() => { setRedo(null); setResult(null) }} />
  if (redo) return <QuizRunner title="Missed questions" questions={QUESTIONS.filter((q) => redo.includes(q.id))} onFinish={setResult} onExit={() => setRedo(null)} />

  const SortHead = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => (
    <th className={`px-4 py-2.5 font-medium ${className}`} aria-sort={sort === k ? (dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        className={`inline-flex items-center gap-1 ${sort === k ? 'text-ink' : 'hover:text-ink'}`}
        onClick={() => (sort === k ? setDir(dir === 1 ? -1 : 1) : (setSort(k), setDir(-1)))}
      >
        {label}
        {sort === k ? (dir === -1 ? <CaretDown size={12} weight="bold" /> : <CaretUp size={12} weight="bold" />) : <CaretDown size={12} className="opacity-30" />}
      </button>
    </th>
  )

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented options={CAREER_TABS} value={tab} onChange={setTab} size="sm" />
        {tab === 'Missed questions' && (
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="missed-event">Event</label>
            <select id="missed-event" className="input h-9 w-auto" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="all">All events</option>
              {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button className="btn-primary" disabled={!wrong.length} onClick={() => setRedo(wrong.map((w) => w.q.id))}>
              <ArrowCounterClockwise size={15} /> Redo all {wrong.length}
            </button>
          </div>
        )}
      </div>

      {tab === 'Past exams' ? (
        <div className="surface overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="px-4 py-2.5 font-medium">Exam</th>
                <SortHead k="date" label="Date" className="hidden sm:table-cell" />
                <SortHead k="accuracy" label="Accuracy" />
                <SortHead k="time" label="Time" />
                <th className="hidden px-4 py-2.5 font-medium sm:table-cell">ELO</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {exams.map((e) => (
                <tr key={e.id} className="hover:bg-canvas">
                  <td className="px-4 py-3">
                    <p className="font-medium">{e.name}</p>
                    <p className="text-xs text-ink-3">{eventName(e.event)}</p>
                  </td>
                  <td className="num hidden px-4 py-3 text-ink-2 sm:table-cell">{new Date(e.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td className={`num px-4 py-3 font-medium ${e.accuracy < 70 ? 'text-bad' : ''}`}>{e.accuracy}%</td>
                  <td className="num px-4 py-3 text-ink-2">{e.timeMin}m</td>
                  <td className={`num hidden px-4 py-3 sm:table-cell ${e.eloDelta >= 0 ? 'text-good' : 'text-bad'}`}>{e.eloDelta >= 0 ? '+' : ''}{e.eloDelta}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="btn-ghost btn-sm whitespace-nowrap text-brand" onClick={() => setRedo(e.wrongIds)}>Redo misses</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : wrong.length === 0 ? (
        <div className="surface"><EmptyState icon={<CheckCircle size={18} />} title="Nothing missed here" body="No missed questions for this event." /></div>
      ) : (
        <ul className="surface divide-y divide-line">
          {wrong.map(({ q, from }) => (
            <li key={q.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-start">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-ink-3">{eventName(q.event)}, from {from}</p>
                <p className="mt-1 text-[15px]">{q.prompt}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-good"><CheckCircle size={15} weight="fill" /> {q.choices[q.answer]}</p>
              </div>
              <button className="btn-secondary btn-sm self-start" onClick={() => setRedo([q.id])}>Redo</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
