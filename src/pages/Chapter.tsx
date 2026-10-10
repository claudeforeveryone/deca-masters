import { useState } from 'react'
import { Copy, Link2, Megaphone, Newspaper, Shield, UserMinus, Ban, Mail, Plus, Shuffle, Pencil, Check, Trophy, BarChart3 } from 'lucide-react'
import { ANNOUNCEMENTS, ATTENDANCE, EVENTS, ME, MY_STATS, PLAYERS, QUESTIONS, eventName, type EventId, type Player } from '../data/mock'
import { Bar, PageHeader, PlayerRow, StatCard, Tabs } from '../components/ui'

type Role = 'President' | 'Executive' | 'Trainer' | 'Member'
const TABS = ['Classroom', 'Leaderboard', 'Members', 'Events & Trainers', 'Attendance', 'Insights', 'Assignments'] as const
const CHAPTER_NAME = 'Lincoln DECA'
const CODE = 'LINC-7Q4K'

export default function Chapter() {
  const [joined, setJoined] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]>('Classroom')
  const [viewAs, setViewAs] = useState<Role>('President')
  const isAdmin = viewAs === 'President' || viewAs === 'Executive'
  const canTrain = isAdmin || viewAs === 'Trainer'

  if (!joined) return <JoinOrRegister onDone={() => setJoined(true)} />

  return (
    <div>
      <PageHeader
        title={CHAPTER_NAME}
        subtitle={`Lincoln High · Chapter code ${CODE}`}
        action={
          <label className="flex items-center gap-2 text-sm">
            <span className="muted">Preview as</span>
            <select className="input w-auto" value={viewAs} onChange={(e) => setViewAs(e.target.value as Role)}>
              {(['President', 'Executive', 'Trainer', 'Member'] as Role[]).map((r) => <option key={r}>{r}</option>)}
            </select>
            <button className="btn-ghost" onClick={() => setJoined(false)}>Leave</button>
          </label>
        }
      />
      <div className="mb-6 overflow-x-auto">
        <Tabs tabs={TABS.filter((t) => isAdmin || !['Insights', 'Attendance'].includes(t) || (t === 'Attendance' && canTrain))} value={tab} onChange={setTab} />
      </div>

      {tab === 'Classroom' && <Classroom canPost={canTrain} isPresident={viewAs === 'President'} />}
      {tab === 'Leaderboard' && <ChapterBoard />}
      {tab === 'Members' && <Members isAdmin={isAdmin} />}
      {tab === 'Events & Trainers' && <EventsTrainers isAdmin={isAdmin} />}
      {tab === 'Attendance' && <Attendance />}
      {tab === 'Insights' && <Insights />}
      {tab === 'Assignments' && <Assignments canEdit={canTrain} />}
    </div>
  )
}

function JoinOrRegister({ onDone }: { onDone: () => void }) {
  return (
    <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <div className="card p-6">
        <h2 className="text-xl font-extrabold">Join a chapter</h2>
        <p className="muted mt-1">Enter the code from your chapter president, or open their invite link.</p>
        <input className="input mt-4 uppercase" placeholder="e.g. LINC-7Q4K" />
        <button className="btn-primary mt-3 w-full" onClick={onDone}>Join chapter</button>
      </div>
      <div className="card bg-navy p-6 text-white">
        <h2 className="text-xl font-extrabold">Register a new chapter</h2>
        <p className="mt-1 text-sm text-sky-200">For chapter presidents. You’ll get a join code and invite link to share.</p>
        <div className="mt-4 space-y-3">
          <input className="input text-navy" placeholder="Chapter name" />
          <input className="input text-navy" placeholder="School name" />
          <input className="input text-navy" placeholder="Advisor email" />
        </div>
        <button className="btn mt-3 w-full bg-deca-light text-navy hover:bg-white" onClick={onDone}>Create chapter</button>
      </div>
    </div>
  )
}

function Classroom({ canPost, isPresident }: { canPost: boolean; isPresident: boolean }) {
  const [posts, setPosts] = useState(ANNOUNCEMENTS)
  const [kind, setKind] = useState<'Announcement' | 'Link' | 'Newsletter'>('Announcement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [digest, setDigest] = useState(true)
  const [nudge, setNudge] = useState(true)

  const post = () => {
    if (!title) return
    setPosts([{ id: `a${Date.now()}`, type: kind, author: ME.name, role: isPresident ? 'President' : 'Trainer', title, body, date: 'Just now' }, ...posts])
    setTitle('')
    setBody('')
  }
  const icon = (t: string) => (t === 'Link' ? <Link2 className="h-4 w-4" /> : t === 'Newsletter' ? <Newspaper className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />)

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        {canPost && (
          <div className="card p-5">
            <div className="flex gap-2">
              {(['Announcement', 'Link', ...(isPresident ? ['Newsletter'] : [])] as const).map((k) => (
                <button key={k} onClick={() => setKind(k as typeof kind)} className={`chip ${kind === k ? 'bg-deca text-white' : ''}`}>{k}</button>
              ))}
            </div>
            <input className="input mt-3" placeholder={kind === 'Link' ? 'Link title' : 'Title'} value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea className="input mt-2 h-24" placeholder={kind === 'Link' ? 'https://…' : 'Write something to your chapter…'} value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="mt-2 text-right"><button className="btn-primary" onClick={post}>Post</button></div>
          </div>
        )}
        {posts.map((a) => (
          <article key={a.id} className={`card p-5 ${a.type === 'Newsletter' ? 'border-l-4 border-l-deca' : ''}`}>
            <div className="flex items-center gap-2 text-xs text-navy/50">
              <span className="chip">{icon(a.type)} {a.type}</span>
              {a.author} · {a.role} · {a.date}
            </div>
            <h3 className="mt-2 text-lg font-bold">{a.title}</h3>
            {a.type === 'Link' ? (
              <a href={a.body.split(' ')[0]} target="_blank" rel="noreferrer" className="text-sm font-semibold text-deca underline">{a.body}</a>
            ) : (
              <p className="mt-1 text-sm text-navy/70">{a.body}</p>
            )}
          </article>
        ))}
      </div>

      <div className="space-y-6">
        <div className="card p-5">
          <h2 className="section-title flex items-center gap-2"><Mail className="h-5 w-5 text-deca" /> Email automation</h2>
          <Toggle label="Weekly overview email" desc="Every Monday: assignments due, upcoming events, chapter rank." on={digest} set={setDigest} disabled={!isPresident} />
          <Toggle label="Inactivity nudges" desc="Reminds members who haven’t practiced in 7+ days." on={nudge} set={setNudge} disabled={!isPresident} />
        </div>
        <InviteCard />
      </div>
    </div>
  )
}

function Toggle({ label, desc, on, set, disabled }: { label: string; desc: string; on: boolean; set: (b: boolean) => void; disabled?: boolean }) {
  return (
    <div className="mt-4 flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-xs text-navy/50">{desc}</p>
      </div>
      <button disabled={disabled} onClick={() => set(!on)} className={`relative h-6 w-11 shrink-0 rounded-full transition ${on ? 'bg-deca' : 'bg-sky-200'} disabled:opacity-50`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${on ? 'left-5' : 'left-0.5'}`} />
      </button>
    </div>
  )
}

function InviteCard() {
  const [copied, setCopied] = useState('')
  const link = `https://decamasters.app/join/${CODE}`
  const copy = (v: string) => { navigator.clipboard?.writeText(v); setCopied(v); setTimeout(() => setCopied(''), 1500) }
  return (
    <div className="card p-5">
      <h2 className="section-title">Invite members</h2>
      {[['Join code', CODE], ['Invite link', link]].map(([l, v]) => (
        <div key={l} className="mt-3">
          <p className="text-xs font-semibold text-navy/50">{l}</p>
          <div className="mt-1 flex gap-2">
            <code className="flex-1 truncate rounded-lg bg-sky-50 px-3 py-2 text-sm">{v}</code>
            <button className="btn-ghost px-3" onClick={() => copy(v)}>{copied === v ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
          </div>
        </div>
      ))}
      <input className="input mt-4" placeholder="Invite a player by username…" />
    </div>
  )
}

const chapterPlayers = () => PLAYERS.filter((p) => p.chapter === CHAPTER_NAME)

function ChapterBoard() {
  const members = chapterPlayers()
  const total = members.reduce((s, p) => s + p.elo, 0)
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        <h2 className="section-title mb-3">Chapter leaderboard</h2>
        {members.map((p, i) => <PlayerRow key={p.id} p={p} rank={i + 1} highlight={p.id === ME.id} />)}
        <p className="muted mt-3">New members start at 0 ELO — every correct answer moves you up.</p>
      </div>
      <div className="space-y-4">
        <StatCard label="Chapter ELO" value={total.toLocaleString()} sub="Sum of all members" icon={<Trophy className="h-5 w-5" />} />
        <StatCard label="Global chapter rank" value="#1" sub="of 6 chapters" />
      </div>
    </div>
  )
}

function Members({ isAdmin }: { isAdmin: boolean }) {
  const [roles, setRoles] = useState<Record<string, Role>>({ p0: 'President', p2: 'Executive', p5: 'Trainer', p10: 'Member' })
  const [members, setMembers] = useState<Player[]>(chapterPlayers())
  const [banned, setBanned] = useState<Player[]>([])
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-navy text-left text-xs uppercase tracking-wide text-sky-200">
          <tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Role</th><th className="hidden px-4 py-3 sm:table-cell">ELO</th>{isAdmin && <th className="px-4 py-3 text-right">Actions</th>}</tr>
        </thead>
        <tbody className="divide-y divide-sky-100">
          {members.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-3"><div className="flex items-center gap-2"><img src={p.avatar} className="h-8 w-8 rounded-full" alt="" /><div><p className="font-semibold">{p.name}</p><p className="text-xs text-navy/50">Grade {p.grade}</p></div></div></td>
              <td className="px-4 py-3">
                {isAdmin && roles[p.id] !== 'President' ? (
                  <select className="input w-auto py-1" value={roles[p.id] ?? 'Member'} onChange={(e) => setRoles({ ...roles, [p.id]: e.target.value as Role })}>
                    {(['Executive', 'Trainer', 'Member'] as Role[]).map((r) => <option key={r}>{r}</option>)}
                  </select>
                ) : (
                  <span className="chip">{roles[p.id] === 'President' && <Shield className="h-3 w-3" />}{roles[p.id] ?? 'Member'}</span>
                )}
              </td>
              <td className="hidden px-4 py-3 font-bold text-deca sm:table-cell">{p.elo}</td>
              {isAdmin && (
                <td className="px-4 py-3 text-right">
                  {roles[p.id] !== 'President' && (
                    <div className="inline-flex gap-1">
                      <button title="Remove" className="btn-ghost px-2" onClick={() => setMembers(members.filter((m) => m.id !== p.id))}><UserMinus className="h-4 w-4" /></button>
                      <button title="Ban" className="btn px-2 bg-red-50 text-red-600 hover:bg-red-100" onClick={() => { setMembers(members.filter((m) => m.id !== p.id)); setBanned([...banned, p]) }}><Ban className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {banned.length > 0 && (
        <div className="border-t border-sky-100 bg-red-50/50 px-4 py-3 text-sm">
          <span className="font-semibold text-red-600">Banned:</span> {banned.map((b) => b.name).join(', ')}
        </div>
      )}
    </div>
  )
}

function EventsTrainers({ isAdmin }: { isAdmin: boolean }) {
  const members = chapterPlayers()
  const [trainers, setTrainers] = useState<Record<EventId, string[]>>({
    entrepreneurship: ['p2'], finance: ['p5'], marketing: ['p0', 'p2'], hospitality: [], management: ['p10'], core: ['p5'],
  })
  const toggle = (ev: EventId, id: string) => {
    const cur = trainers[ev]
    if (cur.includes(id)) setTrainers({ ...trainers, [ev]: cur.filter((x) => x !== id) })
    else if (cur.length < 2) setTrainers({ ...trainers, [ev]: [...cur, id] })
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {EVENTS.map((e) => (
        <div key={e.id} className="card overflow-hidden">
          <div className="h-2" style={{ background: e.color }} />
          <div className="p-5">
            <h3 className="font-bold">{e.name}</h3>
            <p className="text-xs text-navy/50">Trainers ({trainers[e.id].length}/2)</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {members.map((p) => {
                const on = trainers[e.id].includes(p.id)
                if (!isAdmin && !on) return null
                return (
                  <button key={p.id} disabled={!isAdmin} onClick={() => toggle(e.id, p.id)} className={`chip ${on ? 'bg-deca text-white' : 'bg-sky-50 text-navy/60'}`}>
                    {p.name.split(' ')[0]}
                  </button>
                )
              })}
              {!isAdmin && trainers[e.id].length === 0 && <span className="muted">No trainer yet</span>}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

function Attendance() {
  const members = chapterPlayers()
  const [present, setPresent] = useState<Set<string>>(new Set(members.map((m) => m.id)))
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="card p-5 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Today’s meeting — Oct 10</h2>
          <span className="chip">{present.size}/{members.length} present</span>
        </div>
        <ul className="mt-3 divide-y divide-sky-100">
          {members.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2"><img src={p.avatar} className="h-7 w-7 rounded-full" alt="" />{p.name}</span>
              <button
                onClick={() => { const n = new Set(present); n.has(p.id) ? n.delete(p.id) : n.add(p.id); setPresent(n) }}
                className={`chip ${present.has(p.id) ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}
              >
                {present.has(p.id) ? 'Present' : 'Absent'}
              </button>
            </li>
          ))}
        </ul>
        <button className="btn-primary mt-4">Save attendance</button>
      </div>
      <div className="card p-5">
        <h2 className="section-title">History</h2>
        <ul className="mt-3 space-y-3">
          {ATTENDANCE.map((a) => (
            <li key={a.date}>
              <div className="flex justify-between text-sm"><span>{a.date}</span><span className="font-semibold">{a.present}/{a.total}</span></div>
              <Bar value={(a.present / a.total) * 100} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Insights() {
  const members = chapterPlayers()
  // Mock per-member weak areas derived from the demo stats.
  const weak = (i: number) => [...MY_STATS.bySection].sort((a, b) => ((a.accuracy * (i + 3)) % 17) - ((b.accuracy * (i + 3)) % 17))[0]
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Avg accuracy" value="76%" icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard label="Active this week" value={`${members.length - 1}/${members.length}`} />
        <StatCard label="Avg attendance" value="88%" />
        <StatCard label="Chapter weak spot" value="Finance" sub="69% avg accuracy" />
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-navy text-left text-xs uppercase tracking-wide text-sky-200">
            <tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">ELO</th><th className="hidden px-4 py-3 md:table-cell">Questions</th><th className="px-4 py-3">Weakest event</th><th className="hidden px-4 py-3 sm:table-cell">Attendance</th><th className="hidden px-4 py-3 md:table-cell">Last active</th></tr>
          </thead>
          <tbody className="divide-y divide-sky-100">
            {members.map((p, i) => {
              const w = weak(i)
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3 font-semibold">{p.name}</td>
                  <td className="px-4 py-3 font-bold text-deca">{p.elo}</td>
                  <td className="hidden px-4 py-3 md:table-cell">{900 + i * 137}</td>
                  <td className="px-4 py-3"><span className="chip bg-red-50 text-red-600">{eventName(w.event)} · {w.accuracy - i}%</span></td>
                  <td className="hidden px-4 py-3 sm:table-cell">{95 - i * 4}%</td>
                  <td className="hidden px-4 py-3 md:table-cell">{i === 3 ? <span className="text-red-500">9 days ago</span> : `${i + 1}h ago`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Assignments({ canEdit }: { canEdit: boolean }) {
  const [questions, setQuestions] = useState(QUESTIONS.slice(0, 5))
  const [editing, setEditing] = useState<string | null>(null)
  const [items, setItems] = useState([
    { title: 'Ratios flashcard set', type: 'Flashcards', event: 'finance' as EventId, due: 'Oct 12', done: 14 },
    { title: 'Marketing mock exam — shuffled', type: 'Test', event: 'marketing' as EventId, due: 'Oct 15', done: 9 },
  ])
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState('Test')
  const [newEvent, setNewEvent] = useState<EventId>('core')

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="card p-5">
          <h2 className="section-title">Assigned work</h2>
          <ul className="mt-3 space-y-2">
            {items.map((a) => (
              <li key={a.title} className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2 text-sm">
                <div><p className="font-semibold">{a.title}</p><p className="text-xs text-navy/50">{a.type} · {eventName(a.event)} · due {a.due}</p></div>
                <span className="chip">{a.done} done</span>
              </li>
            ))}
          </ul>
        </div>
        {canEdit && (
          <div className="card p-5">
            <h2 className="section-title">Create assignment</h2>
            <input className="input mt-3" placeholder="Title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <select className="input" value={newType} onChange={(e) => setNewType(e.target.value)}><option>Test</option><option>Flashcards</option><option>Existing exam (shuffled)</option></select>
              <select className="input" value={newEvent} onChange={(e) => setNewEvent(e.target.value as EventId)}>{EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
            </div>
            <button className="btn-primary mt-3" onClick={() => { if (newTitle) { setItems([...items, { title: newTitle, type: newType, event: newEvent, due: 'Oct 20', done: 0 }]); setNewTitle('') } }}>
              <Plus className="h-4 w-4" /> Assign to chapter
            </button>
          </div>
        )}
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Test builder</h2>
          {canEdit && <button className="btn-ghost" onClick={() => setQuestions([...questions].sort(() => Math.random() - 0.5))}><Shuffle className="h-4 w-4" /> Shuffle</button>}
        </div>
        <ol className="mt-3 space-y-3">
          {questions.map((q, i) => (
            <li key={q.id} className="rounded-xl border border-sky-100 p-3 text-sm">
              {editing === q.id ? (
                <textarea
                  className="input h-20"
                  value={q.prompt}
                  onChange={(e) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)))}
                />
              ) : (
                <p><span className="font-bold text-deca">{i + 1}.</span> {q.prompt}</p>
              )}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-xs text-navy/50">Answer: {q.choices[q.answer]}</span>
                {canEdit && (
                  <button className="text-xs font-semibold text-deca" onClick={() => setEditing(editing === q.id ? null : q.id)}>
                    {editing === q.id ? <><Check className="inline h-3 w-3" /> Done</> : <><Pencil className="inline h-3 w-3" /> Edit</>}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
