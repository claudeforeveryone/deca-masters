import { useMemo, useState } from 'react'
import { Trophy, Flame, Crosshair, Sword, BookOpenText, Lightning, Camera, ArrowCounterClockwise, CaretUp, CaretDown, CheckCircle } from '@phosphor-icons/react'
import { ACHIEVEMENTS, EVENTS, ME, MY_STATS, PAST_EXAMS, PLAYERS, QUESTIONS, eventName, eventOf } from '../data/mock'
import { ArrowLink, Avatar, EloChart, EmptyState, Meter, RankRow, SectionHeader, Stat, Tabs } from '../components/ui'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'

const TABS = ['Overview', 'Career'] as const
const ACH_ICONS = { trophy: Trophy, flame: Flame, target: Crosshair, swords: Sword, book: BookOpenText, bolt: Lightning } as const

export default function Me() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Overview')
  return (
    <div>
      <ProfileBand />
      <Tabs options={TABS} value={tab} onChange={setTab} />
      <div key={tab} className="enter mt-10">{tab === 'Overview' ? <Overview /> : <Career />}</div>
    </div>
  )
}

function ProfileBand() {
  return (
    <section className="bleed diamond-pattern mb-10 bg-brand text-white">
      <div className="container-page flex flex-col gap-8 py-10 sm:py-14 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-center gap-6">
          <div className="relative">
            <Avatar name={ME.name} size={96} inverse />
            <button className="absolute -bottom-2 -right-2 grid h-9 w-9 place-items-center bg-navy text-white hover:bg-navy-deep" aria-label="Change profile photo">
              <Camera size={16} />
            </button>
          </div>
          <div>
            <h1 className="display text-4xl sm:text-5xl">{ME.name}</h1>
            <p className="mt-2 text-white/90">{ME.school}, grade {ME.grade}</p>
            <p className="mt-1 text-sm text-white/80">{ME.chapter}, main event Marketing</p>
          </div>
        </div>
        <dl className="flex gap-10">
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-label text-white/80">ELO</dt>
            <dd className="num text-5xl font-extrabold">{ME.elo.toLocaleString()}</dd>
          </div>
          <div>
            <dt className="text-[11px] font-bold uppercase tracking-label text-white/80">Rank</dt>
            <dd className="num text-5xl font-extrabold">#{MY_STATS.rank}</dd>
          </div>
        </dl>
      </div>
    </section>
  )
}

function Overview() {
  const myIdx = PLAYERS.findIndex((p) => p.id === ME.id)
  const around = PLAYERS.slice(Math.max(0, myIdx - 2), myIdx + 3)
  const sections = [...MY_STATS.bySection].sort((a, b) => b.accuracy - a.accuracy)

  return (
    <div className="space-y-16">
      <section className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
        {[
          ['Accuracy', `${MY_STATS.accuracy}%`, undefined],
          ['Questions', MY_STATS.questionsDone.toLocaleString(), undefined],
          ['Time practiced', `${MY_STATS.timeSpentHrs}h`, undefined],
          ['Arena record', `${MY_STATS.arenaRecord.w}-${MY_STATS.arenaRecord.l}`, 'Wins and losses'],
          ['Current streak', `${MY_STATS.streak} days`, undefined],
          ['Best streak', `${MY_STATS.bestStreak} days`, undefined],
          ['Best exam', `${MY_STATS.bestPaper.score}%`, MY_STATS.bestPaper.name],
          ['Exams taken', String(PAST_EXAMS.length), 'Full and practice'],
        ].map(([label, value, hint]) => (
          <div key={label} className="bg-white p-6">
            <Stat label={label!} value={value} hint={hint} />
          </div>
        ))}
      </section>

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="space-y-12">
          <section>
            <SectionHeader title="Accuracy by career cluster" />
            <ul className="space-y-5">
              {sections.map((s) => {
                const e = eventOf(s.event)
                return (
                  <li key={s.event} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[210px_1fr_110px]">
                    <span className="flex items-center gap-2.5 text-sm font-semibold text-ink">
                      <span className="h-3 w-3 shrink-0" style={{ background: e.color }} aria-hidden />
                      {e.name}
                    </span>
                    <span className="num text-right text-sm font-semibold text-ink sm:order-last">
                      {s.accuracy}% <span className="text-xs font-normal text-ink-3">of {s.done}</span>
                    </span>
                    <div className="col-span-2 sm:col-span-1"><Meter value={s.accuracy} color={e.color} /></div>
                  </li>
                )
              })}
            </ul>
          </section>

          <section>
            <SectionHeader title="ELO over time" action={<span className="num text-sm font-semibold text-good">+{ME.elo - MY_STATS.eloHistory[0]} this season</span>} />
            <EloChart data={MY_STATS.eloHistory} height={170} />
          </section>
        </div>

        <aside>
          <SectionHeader title="Players near you" action={<ArrowLink to="/leaderboard">All</ArrowLink>} />
          <div className="divide-y divide-line border border-line">
            {around.map((p) => <RankRow key={p.id} p={p} rank={PLAYERS.indexOf(p) + 1} me={p.id === ME.id} />)}
          </div>
        </aside>
      </div>

      <section>
        <SectionHeader title="Achievements" />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {ACHIEVEMENTS.map((a, i) => {
            const Icon = ACH_ICONS[a.icon as keyof typeof ACH_ICONS]
            const feature = i === 0
            return (
              <li key={a.title} className={`flex items-start gap-4 p-6 ${feature ? 'bg-navy-midnight text-white' : 'panel'}`}>
                <Icon size={30} weight="duotone" className={feature ? 'text-tint-2' : 'text-brand'} />
                <div className="min-w-0">
                  <p className={`font-semibold ${feature ? 'text-white' : 'text-brand'}`}>{a.title}</p>
                  <p className={`mt-1 text-sm ${feature ? 'text-white/80' : 'text-ink-2'}`}>{a.desc}</p>
                  <p className={`mt-3 text-xs ${feature ? 'text-white/60' : 'text-ink-3'}`}>Earned {a.date}</p>
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
    <th className={`py-3 pr-4 ${className}`} aria-sort={sort === k ? (dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        className={`inline-flex items-center gap-1 uppercase ${sort === k ? 'text-brand' : 'hover:text-brand'}`}
        onClick={() => (sort === k ? setDir(dir === 1 ? -1 : 1) : (setSort(k), setDir(-1)))}
      >
        {label}
        {sort === k ? (dir === -1 ? <CaretDown size={12} weight="bold" /> : <CaretUp size={12} weight="bold" />) : <CaretDown size={12} className="opacity-30" />}
      </button>
    </th>
  )

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {CAREER_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} className={tab === t ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>{t}</button>
          ))}
        </div>
        {tab === 'Missed questions' && (
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="missed-event">Career cluster</label>
            <select id="missed-event" className="input w-auto" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)}>
              <option value="all">All clusters</option>
              {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button className="btn-primary" disabled={!wrong.length} onClick={() => setRedo(wrong.map((w) => w.q.id))}>
              <ArrowCounterClockwise size={16} /> Redo all {wrong.length}
            </button>
          </div>
        )}
      </div>

      {tab === 'Past exams' ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="py-3 pr-4">Exam</th>
                <SortHead k="date" label="Date" className="hidden sm:table-cell" />
                <SortHead k="accuracy" label="Accuracy" />
                <SortHead k="time" label="Time" />
                <th className="hidden py-3 pr-4 sm:table-cell">ELO</th>
                <th className="py-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {exams.map((e) => (
                <tr key={e.id} className="hover:bg-canvas">
                  <td className="py-4 pr-4">
                    <p className="font-semibold text-ink">{e.name}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                      <span className="h-2 w-2" style={{ background: eventOf(e.event).color }} aria-hidden />
                      {eventName(e.event)}
                    </p>
                  </td>
                  <td className="num hidden py-4 pr-4 text-ink-2 sm:table-cell">{new Date(e.date + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                  <td className={`num py-4 pr-4 font-semibold ${e.accuracy < 70 ? 'text-bad' : 'text-ink'}`}>{e.accuracy}%</td>
                  <td className="num py-4 pr-4 text-ink-2">{e.timeMin} min</td>
                  <td className={`num hidden py-4 pr-4 font-semibold sm:table-cell ${e.eloDelta >= 0 ? 'text-good' : 'text-bad'}`}>{e.eloDelta >= 0 ? '+' : ''}{e.eloDelta}</td>
                  <td className="py-4 text-right">
                    <ArrowLink onClick={() => setRedo(e.wrongIds)}>Redo misses</ArrowLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : wrong.length === 0 ? (
        <div className="panel"><EmptyState icon={<CheckCircle size={20} />} title="Nothing missed here" body="No missed questions in this cluster." /></div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {wrong.map(({ q, from }) => (
            <li key={q.id} className="panel flex flex-col p-6">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-label text-ink-3">
                <span className="h-2.5 w-2.5" style={{ background: eventOf(q.event).color }} aria-hidden />
                {eventName(q.event)}
              </p>
              <p className="mt-3 flex-1 font-medium text-ink">{q.prompt}</p>
              <p className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-good"><CheckCircle size={16} weight="fill" /> {q.choices[q.answer]}</p>
              <p className="mt-1 text-xs text-ink-3">Missed in {from}</p>
              <div className="mt-5"><ArrowLink onClick={() => setRedo([q.id])}>Redo question</ArrowLink></div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
