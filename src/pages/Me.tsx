import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy, Flame, Crosshair, Sword, Lightning, Target, Medal, UsersThree, ArrowCounterClockwise, CaretUp, CaretDown, CheckCircle, ClockCounterClockwise, Lock } from '@phosphor-icons/react'
import { EXAMS, examOf, type ExamId } from '../data/events'
import { QUESTIONS } from '../data/questions'
import { eloSeries, useMyEvent, useStore, type Progress } from '../store'
import { ArrowLink, Avatar, EloChart, EmptyState, EventPicker, Meter, RankRow, SectionHeader, Stat, Tabs } from '../components/ui'
import QuizRunner, { ResultCard, type QuizResult } from '../components/QuizRunner'

const TABS = ['Overview', 'Career'] as const

const fmtHours = (s: number) => (s < 3600 ? `${Math.round(s / 60)}m` : `${(s / 3600).toFixed(1)}h`)

function achievements(p: Progress, inChapter: boolean) {
  const bestSession = p.history.filter((h) => h.total >= 5).reduce((m, h) => Math.max(m, h.correct / h.total), 0)
  return [
    { icon: Target, title: 'First answer', desc: 'Answer your first question.', done: p.answered >= 1 },
    { icon: Medal, title: 'Century', desc: 'Answer 100 questions.', done: p.answered >= 100, progress: `${Math.min(p.answered, 100)}/100` },
    { icon: Flame, title: 'On a roll', desc: 'Practice 3 days in a row.', done: p.bestStreak >= 3, progress: `${Math.min(p.bestStreak, 3)}/3` },
    { icon: Lightning, title: 'Week warrior', desc: 'Practice 7 days in a row.', done: p.bestStreak >= 7, progress: `${Math.min(p.bestStreak, 7)}/7` },
    { icon: Crosshair, title: 'Sharpshooter', desc: 'Score 90% or better on a session of 5 or more questions.', done: bestSession >= 0.9 },
    { icon: Sword, title: 'First win', desc: 'Win an Arena match.', done: p.arena.w >= 1 },
    { icon: Trophy, title: 'Arena veteran', desc: 'Win 10 Arena matches.', done: p.arena.w >= 10, progress: `${Math.min(p.arena.w, 10)}/10` },
    { icon: UsersThree, title: 'Team player', desc: 'Join or create a chapter.', done: inChapter },
  ]
}

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
  const { me, isGuest, myChapter, myRank, setEvent } = useStore()
  const { event, cluster, exam } = useMyEvent()
  const [editing, setEditing] = useState(false)
  return (
    <section className="bleed diamond-pattern mb-10 bg-brand text-white">
      <div className="container-page py-10 sm:py-14">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-center gap-6">
            <Avatar name={isGuest ? 'G' : me!.name} size={96} inverse />
            <div>
              <h1 className="display text-4xl sm:text-5xl">{isGuest ? 'Guest' : me!.name}</h1>
              <p className="mt-2 text-white/90">{isGuest ? 'Progress is saved on this device only' : `${me!.school}, grade ${me!.grade}`}</p>
              <p className="mt-1 text-sm text-white/80">
                {event.code}, {cluster.name}{myChapter ? `. ${myChapter.name}` : ''}
              </p>
            </div>
          </div>
          <dl className="flex gap-10">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-label text-white/80">ELO</dt>
              <dd className="num text-5xl font-extrabold">{me!.progress.elo.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-label text-white/80">Rank</dt>
              <dd className="num text-5xl font-extrabold">#{isGuest ? 0 : myRank}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <button className="btn-white" onClick={() => setEditing(!editing)}>{editing ? 'Done' : 'Change event'}</button>
          {isGuest && <Link to="/register" className="btn-outline-white">Create account</Link>}
        </div>
        {editing && (
          <div className="mt-6 max-w-2xl bg-white p-4 text-ink">
            <EventPicker value={event.code} onChange={(c) => setEvent(c)} />
            <p className="mt-3 text-sm text-ink-2">Your practice uses the <span className="font-semibold text-ink">{examOf(exam).name}</span> exam.</p>
          </div>
        )}
      </div>
    </section>
  )
}

function Overview() {
  const { me, isGuest, players, myRank, myChapter } = useStore()
  const p = me!.progress
  const accuracy = p.answered ? Math.round((p.correct / p.answered) * 100) : 0
  const attempted = EXAMS.filter((x) => (p.byExam[x.id]?.answered ?? 0) > 0)
  const myIdx = players.findIndex((x) => x.isMe)
  const near = myRank > 0 ? players.slice(Math.max(0, myIdx - 2), myIdx + 3) : players.slice(0, 5)
  const ach = achievements(p, !!myChapter)

  return (
    <div className="space-y-16">
      <section className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
        {[
          ['ELO', p.elo.toLocaleString(), undefined],
          ['Global rank', String(isGuest ? 0 : myRank), isGuest ? 'Guests are not ranked' : myRank ? `of ${players.length}` : 'Earn ELO to get ranked'],
          ['Accuracy', `${accuracy}%`, undefined],
          ['Questions', p.answered.toLocaleString(), undefined],
          ['Time practiced', fmtHours(p.seconds), undefined],
          ['Current streak', `${p.streak} days`, undefined],
          ['Best streak', `${p.bestStreak} days`, undefined],
          ['Arena record', `${p.arena.w}-${p.arena.l}`, 'Wins and losses'],
        ].map(([label, value, hint]) => (
          <div key={label} className="bg-white p-6"><Stat label={label!} value={value} hint={hint} /></div>
        ))}
      </section>

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <div className="space-y-12">
          <section>
            <SectionHeader title="Accuracy by exam" />
            {attempted.length === 0 ? (
              <div className="panel"><EmptyState icon={<Target size={20} />} title="No answers yet" body="Your accuracy for each exam shows up once you practice." action={<Link to="/play" className="btn-primary">Start practicing</Link>} /></div>
            ) : (
              <ul className="space-y-5">
                {attempted.map((x) => {
                  const s = p.byExam[x.id]!
                  const acc = Math.round((s.correct / s.answered) * 100)
                  return (
                    <li key={x.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[260px_1fr_110px]">
                      <span className="flex items-center gap-2.5 text-sm font-semibold text-ink"><span className="h-3 w-3 shrink-0" style={{ background: x.color }} aria-hidden />{x.name}</span>
                      <span className="num text-right text-sm font-semibold text-ink sm:order-last">{acc}% <span className="text-xs font-normal text-ink-3">of {s.answered}</span></span>
                      <div className="col-span-2 sm:col-span-1"><Meter value={acc} color={x.color} /></div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section>
            <SectionHeader title="ELO over time" />
            <EloChart data={eloSeries(p.history)} height={170} />
          </section>
        </div>

        <aside>
          <SectionHeader title={myRank ? 'Players near you' : 'Top players'} action={<ArrowLink to="/leaderboard">All</ArrowLink>} />
          <div className="divide-y divide-line border border-line">
            {near.map((x) => <RankRow key={x.id} p={x} rank={x.elo > 0 ? players.indexOf(x) + 1 : 0} />)}
          </div>
        </aside>
      </div>

      <section>
        <SectionHeader title="Achievements" action={<span className="num text-sm font-semibold text-brand">{ach.filter((a) => a.done).length}/{ach.length}</span>} />
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {ach.map((a) => (
            <li key={a.title} className={`flex items-start gap-4 p-6 ${a.done ? 'bg-navy-midnight text-white' : 'panel'}`}>
              {a.done ? <a.icon size={30} weight="duotone" className="shrink-0 text-tint-2" /> : <Lock size={30} className="shrink-0 text-line-strong" />}
              <div className="min-w-0">
                <p className={`font-semibold ${a.done ? 'text-white' : 'text-ink'}`}>{a.title}</p>
                <p className={`mt-1 text-sm ${a.done ? 'text-white/80' : 'text-ink-3'}`}>{a.desc}</p>
                <p className={`mt-3 text-xs font-semibold ${a.done ? 'text-tint-2' : 'text-ink-3'}`}>{a.done ? 'Earned' : a.progress ?? 'Locked'}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}

const CAREER_TABS = ['Past sessions', 'Missed questions'] as const
type SortKey = 'date' | 'accuracy' | 'time'

function Career() {
  const { me, record } = useStore()
  const p = me!.progress
  const [tab, setTab] = useState<(typeof CAREER_TABS)[number]>('Past sessions')
  const [sort, setSort] = useState<SortKey>('date')
  const [dir, setDir] = useState<1 | -1>(-1)
  const [examFilter, setExamFilter] = useState<ExamId | 'all'>('all')
  const [redo, setRedo] = useState<string[] | null>(null)
  const [result, setResult] = useState<{ r: QuizResult; delta: number } | null>(null)

  const sessions = useMemo(() => {
    const val = (h: (typeof p.history)[number]) => (sort === 'accuracy' ? h.correct / h.total : sort === 'time' ? h.seconds : +new Date(h.date))
    return [...p.history].sort((a, b) => (val(a) - val(b)) * dir)
  }, [p.history, sort, dir])

  const wrong = useMemo(() => {
    const seen = new Map<string, string>()
    p.history.forEach((h) => h.wrongIds.forEach((id) => !seen.has(id) && seen.set(id, h.title)))
    return [...seen.entries()]
      .map(([id, from]) => ({ q: QUESTIONS.find((x) => x.id === id), from }))
      .filter((w): w is { q: (typeof QUESTIONS)[number]; from: string } => !!w.q && (examFilter === 'all' || w.q.exam === examFilter))
  }, [p.history, examFilter])

  if (redo && result) return <ResultCard r={result.r} delta={result.delta} title="Review complete" onDone={() => { setRedo(null); setResult(null) }} />
  if (redo) {
    const qs = QUESTIONS.filter((x) => redo.includes(x.id))
    return (
      <QuizRunner
        title="Missed questions"
        questions={qs}
        onFinish={(r) => setResult({ r, delta: record({ title: 'Missed questions review', exam: qs[0].exam, total: r.total, correct: r.correct, seconds: r.seconds, wrongIds: r.wrongIds }) })}
        onExit={() => setRedo(null)}
      />
    )
  }

  const SortHead = ({ k, label, className = '' }: { k: SortKey; label: string; className?: string }) => (
    <th className={`py-3 pr-4 ${className}`} aria-sort={sort === k ? (dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button className={`inline-flex items-center gap-1 uppercase ${sort === k ? 'text-brand' : 'hover:text-brand'}`} onClick={() => (sort === k ? setDir(dir === 1 ? -1 : 1) : (setSort(k), setDir(-1)))}>
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
        {tab === 'Missed questions' && wrong.length > 0 && (
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="missed-exam">Exam</label>
            <select id="missed-exam" className="input w-auto" value={examFilter} onChange={(e) => setExamFilter(e.target.value as ExamId | 'all')}>
              <option value="all">All exams</option>
              {EXAMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
            <button className="btn-primary" onClick={() => setRedo(wrong.map((w) => w.q.id))}><ArrowCounterClockwise size={16} /> Redo all {wrong.length}</button>
          </div>
        )}
      </div>

      {tab === 'Past sessions' ? (
        sessions.length === 0 ? (
          <div className="panel"><EmptyState icon={<ClockCounterClockwise size={20} />} title="No sessions yet" body="Every practice session, exam and Arena match you finish is listed here." action={<Link to="/play" className="btn-primary">Start practicing</Link>} /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="table-head">
                <tr>
                  <th className="py-3 pr-4">Session</th>
                  <SortHead k="date" label="Date" className="hidden sm:table-cell" />
                  <SortHead k="accuracy" label="Accuracy" />
                  <SortHead k="time" label="Time" />
                  <th className="hidden py-3 pr-4 sm:table-cell">ELO</th>
                  <th className="py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sessions.map((h) => {
                  const acc = Math.round((h.correct / h.total) * 100)
                  return (
                    <tr key={h.id} className="hover:bg-canvas">
                      <td className="py-4 pr-4">
                        <p className="font-semibold text-ink">{h.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3"><span className="h-2 w-2" style={{ background: examOf(h.exam).color }} aria-hidden />{examOf(h.exam).name}</p>
                      </td>
                      <td className="num hidden py-4 pr-4 text-ink-2 sm:table-cell">{new Date(h.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
                      <td className={`num py-4 pr-4 font-semibold ${acc < 70 ? 'text-bad' : 'text-ink'}`}>{acc}%</td>
                      <td className="num py-4 pr-4 text-ink-2">{Math.max(1, Math.round(h.seconds / 60))} min</td>
                      <td className={`num hidden py-4 pr-4 font-semibold sm:table-cell ${h.eloDelta >= 0 ? 'text-good' : 'text-bad'}`}>{h.eloDelta >= 0 ? '+' : ''}{h.eloDelta}</td>
                      <td className="py-4 text-right">{h.wrongIds.length > 0 && <ArrowLink onClick={() => setRedo(h.wrongIds)}>Redo misses</ArrowLink>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      ) : wrong.length === 0 ? (
        <div className="panel"><EmptyState icon={<CheckCircle size={20} />} title="Nothing missed" body="Questions you get wrong are saved here so you can retry them." /></div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {wrong.map(({ q, from }) => (
            <li key={q.id} className="panel flex flex-col p-6">
              <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-label text-ink-3"><span className="h-2.5 w-2.5" style={{ background: examOf(q.exam).color }} aria-hidden />{examOf(q.exam).name}</p>
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

