import { useState } from 'react'
import { Sword, PaperPlaneTilt, Check, X, Trophy, MagnifyingGlass, Clock, Lightning, Users } from '@phosphor-icons/react'
import { EVENTS, ME, PLAYERS, QUESTIONS, type EventId, type Player } from '../data/mock'
import QuizRunner, { fmtTime, type QuizResult } from '../components/QuizRunner'
import { Avatar, EmptyState, PageBand, SectionHeader, Tabs } from '../components/ui'

const MATCH_SECONDS = 150 // 10 questions, 2:30 on the clock
const FRIENDS = new Set(['p0', 'p2', 'p5', 'p7'])
const LIST_TABS = ['Online', 'Friends', 'Everyone'] as const

type Challenge = { id: string; from: Player; to: Player; event: EventId | 'mixed' }
type Match = { opponent: Player; me: QuizResult; them: QuizResult }

const eventLabel = (e: EventId | 'mixed') => (e === 'mixed' ? 'Mixed events' : EVENTS.find((x) => x.id === e)!.name)
const didWin = (m: Match) => m.me.correct > m.them.correct || (m.me.correct === m.them.correct && m.me.seconds < m.them.seconds)

export default function Arena() {
  const [tab, setTab] = useState<(typeof LIST_TABS)[number]>('Online')
  const [q, setQ] = useState('')
  const [event, setEvent] = useState<EventId | 'mixed'>('mixed')
  const [outgoing, setOutgoing] = useState<Challenge[]>([])
  const [incoming, setIncoming] = useState<Challenge[]>([
    { id: 'c1', from: PLAYERS[0], to: ME, event: 'marketing' },
    { id: 'c2', from: PLAYERS[7], to: ME, event: 'mixed' },
  ])
  const [opponent, setOpponent] = useState<Player | null>(null)
  const [match, setMatch] = useState<Match | null>(null)
  const [history, setHistory] = useState<Match[]>([])

  const list = PLAYERS.filter((p) => p.id !== ME.id)
    .filter((p) => (tab === 'Online' ? p.online : tab === 'Friends' ? FRIENDS.has(p.id) : true))
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))

  const send = (p: Player) => setOutgoing((o) => [...o, { id: `o${Date.now()}`, from: ME, to: p, event }])

  const finish = (me: QuizResult) => {
    // Opponent is simulated until realtime matches are wired to the backend.
    const theirCorrect = Math.max(0, Math.min(10, Math.round(me.correct + (Math.random() * 4 - 2))))
    const them = { correct: theirCorrect, total: 10, seconds: Math.round(60 + Math.random() * 80), wrongIds: [] }
    const m = { opponent: opponent!, me, them }
    setMatch(m)
    setHistory((h) => [m, ...h])
  }

  if (opponent && !match)
    return (
      <div>
        <div className="bleed diamond-pattern bg-navy-midnight text-white"><div className="container-page flex max-w-2xl items-center justify-between py-5">
          <Versus p={ME} />
          <span className="text-sm font-extrabold tracking-label text-tint-3">VS</span>
          <Versus p={opponent} right />
        </div></div>
        <QuizRunner title="Arena match" questions={QUESTIONS.slice(0, 10)} timeLimitSec={MATCH_SECONDS} showExplanations={false} eloPerCorrect={12} onFinish={finish} />
      </div>
    )

  if (match) {
    const { me, them } = match
    const won = didWin(match)
    const tie = me.correct === them.correct && me.seconds === them.seconds
    return (
      <div className="surface enter mx-auto mt-12 max-w-lg border-t-4 border-t-brand p-8">
        <div className="flex items-center gap-3">
          <span className={`grid h-10 w-10 place-items-center rounded-lg ${won ? 'bg-tint text-brand' : 'bg-canvas text-ink-3'}`}>
            <Trophy size={22} weight={won ? 'fill' : 'regular'} />
          </span>
          <div>
            <h2 className="text-xl font-semibold">{tie ? 'Draw' : won ? 'You won' : 'You lost'}</h2>
            <p className="text-sm text-ink-3">
              {me.correct === them.correct && !tie ? 'Same score, decided by time.' : `Against ${match.opponent.name}`}
            </p>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3">
          {[{ p: ME, r: me, w: won }, { p: match.opponent, r: them, w: !won && !tie }].map(({ p, r, w }) => (
            <div key={p.id} className={`rounded-xl border p-4 ${w ? 'border-brand/40 bg-tint' : 'border-line'}`}>
              <div className="flex items-center gap-2">
                <Avatar name={p.name} size={24} />
                <span className="truncate text-sm font-medium">{p.id === ME.id ? 'You' : p.name.split(' ')[0]}</span>
              </div>
              <p className="num mt-3 text-3xl font-semibold">{r.correct}<span className="text-lg text-ink-3">/10</span></p>
              <p className="num mt-0.5 text-xs text-ink-3">{fmtTime(r.seconds)}</p>
            </div>
          ))}
        </div>
        <p className={`num mt-5 text-sm font-medium ${won ? 'text-good' : 'text-bad'}`}>{won ? '+18' : '-12'} ELO</p>
        <div className="mt-6 flex gap-2">
          <button className="btn-primary flex-1" onClick={() => { setMatch(null); setOpponent(null) }}>Back to Arena</button>
          <button className="btn-secondary" onClick={() => setMatch(null)}>Rematch</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageBand
        tag="1v1"
        title="Arena"
        description="Challenge anyone to a 1v1. Ten questions, two and a half minutes. Most correct wins, and ties go to the faster player."
      />

      <div className="grid gap-12 lg:grid-cols-[1fr_340px]">
        <section>
          <Tabs options={LIST_TABS} value={tab} onChange={setTab} />
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <label className="relative block flex-1">
              <span className="sr-only">Search players</span>
              <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input className="input pl-9" placeholder="Search players" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="arena-event">Event</label>
              <select id="arena-event" className="input w-full sm:w-56" value={event} onChange={(e) => setEvent(e.target.value as EventId | 'mixed')}>
                <option value="mixed">Mixed</option>
                {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
          </div>
          {list.length === 0 ? (
            <div className="panel mt-5"><EmptyState icon={<Users size={20} />} title="No players here" body={tab === 'Online' ? 'Nobody matching is online. Try Everyone.' : 'Try a different search.'} /></div>
          ) : (
            <ul className="mt-5 divide-y divide-line border-y border-line">
              {list.map((p) => {
                const sent = outgoing.some((o) => o.to.id === p.id)
                return (
                  <li key={p.id} className="flex items-center gap-4 px-2 py-4">
                    <span className="relative">
                      <Avatar name={p.name} size={36} />
                      {p.online && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-good" aria-label="Online" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">
                        {p.name}
                        {FRIENDS.has(p.id) && <span className="badge-neutral ml-2">Friend</span>}
                      </p>
                      <p className="num truncate text-xs text-ink-3">{p.elo.toLocaleString()} ELO <span className="font-sans">in {p.chapter}</span></p>
                    </div>
                    {sent ? (
                      <span className="inline-flex items-center gap-1.5 text-sm text-ink-3"><Clock size={15} /> Sent</span>
                    ) : (
                      <button className="btn-secondary btn-sm" onClick={() => send(p)}><Sword size={15} /> Challenge</button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <aside className="space-y-10">
          <section>
            <SectionHeader title="Incoming challenges" />
            {incoming.length === 0 ? (
              <div className="panel"><EmptyState icon={<Lightning size={20} />} title="No challenges waiting" /></div>
            ) : (
              <ul className="space-y-2">
                {incoming.map((c) => (
                  <li key={c.id} className="panel p-5">
                    <div className="flex items-center gap-3">
                      <Avatar name={c.from.name} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{c.from.name}</p>
                        <p className="truncate text-xs text-ink-3">{eventLabel(c.event)}</p>
                      </div>
                      <span className="num text-xs text-ink-3">{c.from.elo.toLocaleString()}</span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button className="btn-primary btn-sm flex-1" onClick={() => { setIncoming((i) => i.filter((x) => x.id !== c.id)); setOpponent(c.from) }}>
                        <Check size={15} /> Accept
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => setIncoming((i) => i.filter((x) => x.id !== c.id))} aria-label="Decline">
                        <X size={15} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {outgoing.length > 0 && (
            <section>
              <SectionHeader title="Sent" />
              <ul className="surface divide-y divide-line">
                {outgoing.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                    <PaperPlaneTilt size={16} className="text-ink-3" />
                    <span className="flex-1 truncate text-sm">{c.to.name}</span>
                    {/* Demo only: start the match as if they accepted */}
                    <button className="text-[13px] font-medium text-brand hover:underline" onClick={() => { setOutgoing((o) => o.filter((x) => x.id !== c.id)); setOpponent(c.to) }}>
                      Simulate accept
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <SectionHeader title="Recent matches" />
            {history.length === 0 ? (
              <p className="text-sm text-ink-3">Your match results will show up here.</p>
            ) : (
              <ul className="surface divide-y divide-line">
                {history.map((m, i) => {
                  const won = didWin(m)
                  return (
                    <li key={i} className="flex items-center gap-3 px-4 py-3 text-sm">
                      <span className={`num grid h-6 w-6 place-items-center rounded-md text-xs font-semibold ${won ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'}`}>{won ? 'W' : 'L'}</span>
                      <span className="flex-1 truncate">{m.opponent.name}</span>
                      <span className="num text-ink-2">{m.me.correct}-{m.them.correct}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

function Versus({ p, right }: { p: Player; right?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${right ? 'flex-row-reverse text-right' : ''}`}>
      <Avatar name={p.name} size={36} />
      <div>
        <p className="text-sm font-medium">{p.id === ME.id ? 'You' : p.name}</p>
        <p className="num text-xs text-white/60">{p.elo.toLocaleString()}</p>
      </div>
    </div>
  )
}
