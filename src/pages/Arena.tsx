import { useState } from 'react'
import { Sword, PaperPlaneTilt, Trophy, MagnifyingGlass, Clock, Users } from '@phosphor-icons/react'
import { examOf } from '../data/events'
import { questionsFor } from '../data/questions'
import { useMyEvent, useStore, type PlayerRow } from '../store'
import QuizRunner, { fmtTime, type QuizResult } from '../components/QuizRunner'
import { Avatar, EmptyState, PageBand, SectionHeader, Tabs } from '../components/ui'

const MATCH_SECONDS = 150 // up to 10 questions, 2:30 on the clock
const ELO_PER_CORRECT = 12
const LIST_TABS = ['Online', 'My chapter', 'Everyone'] as const

type Match = { opponent: PlayerRow; me: QuizResult; them: QuizResult; delta: number }

const didWin = (me: QuizResult, them: QuizResult) => me.correct > them.correct || (me.correct === them.correct && me.seconds < them.seconds)
const shuffle = <T,>(a: T[]) => [...a].sort(() => Math.random() - 0.5)

export default function Arena() {
  const { players, me, myChapter, record } = useStore()
  const { exam } = useMyEvent()
  const [tab, setTab] = useState<(typeof LIST_TABS)[number]>('Online')
  const [q, setQ] = useState('')
  const [sent, setSent] = useState<PlayerRow[]>([])
  const [opponent, setOpponent] = useState<PlayerRow | null>(null)
  const [match, setMatch] = useState<Match | null>(null)

  const history = me!.progress.history.filter((h) => h.arena).slice(0, 8)
  const list = players
    .filter((p) => !p.isMe)
    .filter((p) => (tab === 'Online' ? p.online : tab === 'My chapter' ? !!myChapter && p.chapterId === myChapter.id : true))
    .filter((p) => `${p.name} ${p.eventCode}`.toLowerCase().includes(q.toLowerCase()))
    .slice(0, 40)

  const finish = (mine: QuizResult) => {
    // The opponent is simulated until realtime matches are wired to the backend.
    const skill = Math.min(0.95, Math.max(0.3, opponent!.accuracy / 100))
    const theirCorrect = Array.from({ length: mine.total }).filter(() => Math.random() < skill).length
    const them = { correct: theirCorrect, total: mine.total, seconds: Math.round(50 + Math.random() * 90), wrongIds: [] }
    const won = didWin(mine, them)
    const delta = record({ title: `Arena vs ${opponent!.name}`, exam, total: mine.total, correct: mine.correct, seconds: mine.seconds, wrongIds: mine.wrongIds, arena: { opponent: opponent!.name, won } }, ELO_PER_CORRECT)
    setMatch({ opponent: opponent!, me: mine, them, delta })
  }

  if (opponent && !match)
    return (
      <div>
        <div className="bleed diamond-pattern bg-navy-midnight text-white">
          <div className="container-page flex max-w-2xl items-center justify-between py-5">
            <Versus name={me!.name === 'Guest' ? 'You' : me!.name} sub={`${me!.progress.elo.toLocaleString()} ELO`} />
            <span className="text-sm font-extrabold tracking-label text-tint-3">VS</span>
            <Versus name={opponent.name} sub={`${opponent.elo.toLocaleString()} ELO`} right />
          </div>
        </div>
        <QuizRunner title={`Arena, ${examOf(exam).name}`} questions={shuffle(questionsFor(exam)).slice(0, 10)} timeLimitSec={MATCH_SECONDS} showExplanations={false} eloPerCorrect={ELO_PER_CORRECT} onFinish={finish} />
      </div>
    )

  if (match) {
    const won = didWin(match.me, match.them)
    const tie = match.me.correct === match.them.correct && match.me.seconds === match.them.seconds
    return (
      <div className="surface enter mx-auto mt-12 max-w-lg border-t-4 border-t-brand p-8">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-soft ${won ? 'bg-tint text-brand' : 'bg-canvas text-ink-3'}`}>
            <Trophy size={22} weight={won ? 'fill' : 'regular'} />
          </span>
          <div>
            <h2 className="text-xl">{tie ? 'Draw' : won ? 'You won' : 'You lost'}</h2>
            <p className="text-sm text-ink-3">{match.me.correct === match.them.correct && !tie ? 'Same score, decided by time.' : `Against ${match.opponent.name}`}</p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[{ n: 'You', r: match.me, w: won }, { n: match.opponent.name.split(' ')[0], r: match.them, w: !won && !tie }].map(({ n, r, w }) => (
            <div key={n} className={`border-2 p-4 ${w ? 'border-brand bg-tint' : 'border-line'}`}>
              <p className="truncate text-sm font-semibold text-ink">{n}</p>
              <p className="num mt-3 text-3xl font-semibold text-ink">{r.correct}<span className="text-lg text-ink-3">/{r.total}</span></p>
              <p className="num mt-0.5 text-xs text-ink-3">{fmtTime(r.seconds)}</p>
            </div>
          ))}
        </div>
        <p className={`num mt-5 text-sm font-semibold ${match.delta >= 0 ? 'text-good' : 'text-bad'}`}>{match.delta >= 0 ? '+' : ''}{match.delta} ELO</p>
        <div className="mt-6 flex gap-2">
          <button className="btn-primary flex-1" onClick={() => { setMatch(null); setOpponent(null) }}>Back to Arena</button>
          <button className="btn-secondary" onClick={() => setMatch(null)}>Rematch</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageBand tag="1v1" title="Arena" description={`Challenge anyone to a 1v1 on the ${examOf(exam).name} exam. Two and a half minutes on the clock. Most correct wins, and ties go to the faster player.`} />

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <section>
          <Tabs options={LIST_TABS} value={tab} onChange={setTab} />
          <label className="relative mt-5 block">
            <span className="sr-only">Search players</span>
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className="input pl-9" placeholder="Search by name or event" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          {list.length === 0 ? (
            <div className="panel mt-5">
              <EmptyState icon={<Users size={20} />} title="No players here" body={tab === 'My chapter' ? 'Join a chapter to see your chapter mates here.' : 'Try another tab or search.'} />
            </div>
          ) : (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {list.map((p) => {
                const isSent = sent.some((s) => s.id === p.id)
                return (
                  <li key={p.id} className="flex items-center gap-4 px-2 py-4">
                    <span className="relative">
                      <Avatar name={p.name} size={36} />
                      {p.online && <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-soft border-2 border-white bg-good" aria-label="Online" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                      <p className="num truncate text-xs text-ink-3">{p.eventCode}, {p.elo.toLocaleString()} ELO</p>
                    </div>
                    {isSent ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink-3"><Clock size={15} /> Sent</span>
                    ) : (
                      <button className="btn-secondary btn-sm" onClick={() => setSent([...sent, p])}><Sword size={15} /> Challenge</button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-10">
          <section>
            <SectionHeader title="Sent challenges" />
            {sent.length === 0 ? (
              <p className="text-sm text-ink-3">Challenge a player to start a match.</p>
            ) : (
              <ul className="divide-y divide-line border border-line">
                {sent.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <PaperPlaneTilt size={16} className="text-ink-3" />
                    <span className="flex-1 truncate text-sm text-ink">{p.name}</span>
                    {/* Demo accounts cannot respond, so you can start the match yourself. */}
                    <button className="btn-primary btn-sm" onClick={() => { setSent(sent.filter((x) => x.id !== p.id)); setOpponent(p) }}>Start</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionHeader title="Your record" action={<span className="num text-sm font-semibold text-ink">{me!.progress.arena.w}-{me!.progress.arena.l}</span>} />
            {history.length === 0 ? (
              <p className="text-sm text-ink-3">Your match results will show up here.</p>
            ) : (
              <ul className="divide-y divide-line border border-line">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                    <span className={`grid h-6 w-6 place-items-center rounded-soft text-xs font-bold ${h.arena!.won ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'}`}>{h.arena!.won ? 'W' : 'L'}</span>
                    <span className="flex-1 truncate text-ink">{h.arena!.opponent}</span>
                    <span className="num text-ink-2">{h.correct}/{h.total}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function Versus({ name, sub, right }: { name: string; sub: string; right?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <Avatar name={name} size={36} />
      <div>
        <p className="text-sm font-semibold">{name}</p>
        <p className="num text-xs text-white/60">{sub}</p>
      </div>
    </div>
  )
}
