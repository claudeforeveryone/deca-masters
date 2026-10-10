import { useState } from 'react'
import { Swords, Send, Clock, Check, X, Trophy } from 'lucide-react'
import { EVENTS, ME, PLAYERS, QUESTIONS, type EventId, type Player } from '../data/mock'
import QuizRunner, { fmtTime, type QuizResult } from '../components/QuizRunner'
import { PageHeader, Tabs } from '../components/ui'

const MATCH_SECONDS = 150 // 10 questions, 2:30 on the clock
const FRIENDS = new Set(['p0', 'p2', 'p5', 'p7'])
const LIST_TABS = ['Online', 'Friends', 'Everyone'] as const

type Challenge = { id: string; from: Player; to: Player; event: EventId | 'mixed'; status: 'pending' | 'accepted' }
type Match = { opponent: Player; me: QuizResult; them: QuizResult }

export default function Arena() {
  const [tab, setTab] = useState<(typeof LIST_TABS)[number]>('Online')
  const [q, setQ] = useState('')
  const [event, setEvent] = useState<EventId | 'mixed'>('mixed')
  const [outgoing, setOutgoing] = useState<Challenge[]>([])
  const [incoming, setIncoming] = useState<Challenge[]>([
    { id: 'c1', from: PLAYERS[0], to: ME, event: 'marketing', status: 'pending' },
    { id: 'c2', from: PLAYERS[7], to: ME, event: 'mixed', status: 'pending' },
  ])
  const [opponent, setOpponent] = useState<Player | null>(null)
  const [match, setMatch] = useState<Match | null>(null)
  const [history, setHistory] = useState<Match[]>([])

  const list = PLAYERS.filter((p) => p.id !== ME.id)
    .filter((p) => (tab === 'Online' ? p.online : tab === 'Friends' ? FRIENDS.has(p.id) : true))
    .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))

  const send = (p: Player) => setOutgoing((o) => [...o, { id: `o${Date.now()}`, from: ME, to: p, event, status: 'pending' }])

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
        <div className="mx-auto mb-6 flex max-w-3xl items-center justify-center gap-6 rounded-2xl bg-navy p-4 text-white">
          <Versus p={ME} />
          <Swords className="h-8 w-8 text-deca-light" />
          <Versus p={opponent} />
        </div>
        <QuizRunner title="Arena Match" questions={QUESTIONS.slice(0, 10)} timeLimitSec={MATCH_SECONDS} showExplanations={false} eloPerCorrect={12} onFinish={finish} />
      </div>
    )

  if (match) {
    const { me, them } = match
    const won = me.correct > them.correct || (me.correct === them.correct && me.seconds < them.seconds)
    const tie = me.correct === them.correct && me.seconds === them.seconds
    return (
      <div className="card mx-auto max-w-xl p-8 text-center">
        <Trophy className={`mx-auto h-12 w-12 ${won ? 'text-yellow-500' : 'text-navy/30'}`} />
        <h2 className="mt-2 text-3xl font-extrabold">{tie ? 'Draw' : won ? 'Victory!' : 'Defeat'}</h2>
        {me.correct === them.correct && !tie && <p className="muted">Tied on score — decided by time.</p>}
        <div className="mt-6 grid grid-cols-2 gap-4">
          {[{ p: ME, r: me }, { p: match.opponent, r: them }].map(({ p, r }) => (
            <div key={p.id} className="rounded-2xl bg-sky-50 p-4">
              <img src={p.avatar} className="mx-auto h-12 w-12 rounded-full" alt="" />
              <p className="mt-2 font-semibold">{p.name}</p>
              <p className="text-3xl font-extrabold text-deca">{r.correct}/10</p>
              <p className="text-xs text-navy/50">{fmtTime(r.seconds)}</p>
            </div>
          ))}
        </div>
        <p className={`mt-4 font-bold ${won ? 'text-green-600' : 'text-red-500'}`}>{won ? '+18' : '−12'} ELO</p>
        <div className="mt-6 flex justify-center gap-2">
          <button className="btn-ghost" onClick={() => { setMatch(null) }}>Rematch</button>
          <button className="btn-primary" onClick={() => { setMatch(null); setOpponent(null) }}>Back to Arena</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Arena"
        subtitle={`1v1 head-to-head: 10 questions, ${fmtTime(MATCH_SECONDS)} on the clock. Most correct wins — ties go to the faster player.`}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="section-title">Find an opponent</h2>
            <Tabs tabs={LIST_TABS} value={tab} onChange={setTab} />
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input className="input" placeholder="Search any player by name…" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="input sm:w-56" value={event} onChange={(e) => setEvent(e.target.value as EventId | 'mixed')}>
              <option value="mixed">Mixed events</option>
              {EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          <ul className="mt-4 divide-y divide-sky-100">
            {list.map((p) => {
              const sent = outgoing.some((o) => o.to.id === p.id)
              return (
                <li key={p.id} className="flex items-center gap-3 py-3">
                  <div className="relative">
                    <img src={p.avatar} className="h-10 w-10 rounded-full" alt="" />
                    {p.online && <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{p.name} {FRIENDS.has(p.id) && <span className="chip ml-1">Friend</span>}</p>
                    <p className="text-xs text-navy/50">{p.chapter} · {p.elo} ELO</p>
                  </div>
                  <button className={sent ? 'btn-ghost' : 'btn-primary'} disabled={sent} onClick={() => send(p)}>
                    {sent ? <><Clock className="h-4 w-4" /> Sent</> : <><Send className="h-4 w-4" /> Challenge</>}
                  </button>
                </li>
              )
            })}
            {list.length === 0 && <li className="py-6 text-center muted">No players found.</li>}
          </ul>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <h2 className="section-title">Incoming challenges</h2>
            <ul className="mt-3 space-y-3">
              {incoming.map((c) => (
                <li key={c.id} className="rounded-xl bg-sky-50 p-3">
                  <div className="flex items-center gap-3">
                    <img src={c.from.avatar} className="h-9 w-9 rounded-full" alt="" />
                    <div className="flex-1 text-sm">
                      <p className="font-semibold">{c.from.name}</p>
                      <p className="text-xs text-navy/50">{c.event === 'mixed' ? 'Mixed' : EVENTS.find((e) => e.id === c.event)!.name} · {c.from.elo} ELO</p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button className="btn-primary flex-1" onClick={() => { setIncoming((i) => i.filter((x) => x.id !== c.id)); setOpponent(c.from) }}>
                      <Check className="h-4 w-4" /> Accept
                    </button>
                    <button className="btn-ghost" onClick={() => setIncoming((i) => i.filter((x) => x.id !== c.id))}><X className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
              {incoming.length === 0 && <p className="muted">No pending challenges.</p>}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="section-title">Sent</h2>
            <ul className="mt-3 space-y-2">
              {outgoing.map((c) => (
                <li key={c.id} className="flex items-center justify-between text-sm">
                  <span>{c.to.name}</span>
                  {/* Demo: lets you start the match as if they accepted */}
                  <button className="text-xs font-semibold text-deca" onClick={() => { setOutgoing((o) => o.filter((x) => x.id !== c.id)); setOpponent(c.to) }}>
                    Waiting… (simulate accept)
                  </button>
                </li>
              ))}
              {outgoing.length === 0 && <p className="muted">Challenge someone to get started.</p>}
            </ul>
          </div>

          <div className="card p-5">
            <h2 className="section-title">Recent matches</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {history.length === 0 && <p className="muted">No matches yet this session.</p>}
              {history.map((m, i) => {
                const won = m.me.correct > m.them.correct || (m.me.correct === m.them.correct && m.me.seconds < m.them.seconds)
                return (
                  <li key={i} className="flex justify-between">
                    <span>vs {m.opponent.name}</span>
                    <span className={won ? 'font-bold text-green-600' : 'font-bold text-red-500'}>{won ? 'W' : 'L'} {m.me.correct}–{m.them.correct}</span>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

function Versus({ p }: { p: Player }) {
  return (
    <div className="text-center">
      <img src={p.avatar} className="mx-auto h-12 w-12 rounded-full ring-2 ring-deca-light" alt="" />
      <p className="mt-1 text-sm font-semibold">{p.name}</p>
      <p className="text-xs text-sky-200">{p.elo} ELO</p>
    </div>
  )
}
