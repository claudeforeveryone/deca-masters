import { useState } from 'react'
import { Copy, Check, LinkSimple, Megaphone, Newspaper, UserMinus, Prohibit, EnvelopeSimple, Plus, Shuffle, PencilSimple, ShieldCheck, ArrowSquareOut, UserPlus } from '@phosphor-icons/react'
import { ANNOUNCEMENTS, ATTENDANCE, EVENTS, ME, MY_STATS, PLAYERS, QUESTIONS, eventName, type EventId, type Player } from '../data/mock'
import { Avatar, Meter, RankRow, Stat, Toggle } from '../components/ui'

type Role = 'President' | 'Executive' | 'Trainer' | 'Member'
const TABS = ['Classroom', 'Leaderboard', 'Members', 'Trainers', 'Attendance', 'Insights', 'Assignments'] as const
type Tab = (typeof TABS)[number]
const CHAPTER_NAME = 'Lincoln DECA'
const CODE = 'LINC-7Q4K'
const chapterPlayers = () => PLAYERS.filter((p) => p.chapter === CHAPTER_NAME)

export default function Chapter() {
  const [joined, setJoined] = useState(true)
  const [tab, setTab] = useState<Tab>('Classroom')
  const [viewAs, setViewAs] = useState<Role>('President')
  const isAdmin = viewAs === 'President' || viewAs === 'Executive'
  const canTrain = isAdmin || viewAs === 'Trainer'
  const visible = TABS.filter((t) => (t === 'Insights' ? isAdmin : t === 'Attendance' ? canTrain : true))
  const current = visible.includes(tab) ? tab : 'Classroom'

  if (!joined) return <JoinOrRegister onDone={() => setJoined(true)} />

  return (
    <div>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink text-lg font-semibold text-white">L</span>
          <div>
            <h1 className="text-2xl font-semibold">{CHAPTER_NAME}</h1>
            <p className="text-sm text-ink-3">Lincoln High, {chapterPlayers().length * 9} members</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-ink-3">
            Preview as
            <select className="input h-9 w-auto" value={viewAs} onChange={(e) => setViewAs(e.target.value as Role)}>
              {(['President', 'Executive', 'Trainer', 'Member'] as Role[]).map((r) => <option key={r}>{r}</option>)}
            </select>
          </label>
          <button className="btn-secondary" onClick={() => setJoined(false)}>Leave</button>
        </div>
      </header>

      <nav className="mb-8 mt-6 flex gap-6 overflow-x-auto border-b border-line" aria-label="Chapter sections">
        {visible.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition-colors ${
              current === t ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink'
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div key={current} className="enter">
        {current === 'Classroom' && <Classroom canPost={canTrain} isPresident={viewAs === 'President'} />}
        {current === 'Leaderboard' && <ChapterBoard />}
        {current === 'Members' && <Members isAdmin={isAdmin} />}
        {current === 'Trainers' && <Trainers isAdmin={isAdmin} />}
        {current === 'Attendance' && <Attendance />}
        {current === 'Insights' && <Insights />}
        {current === 'Assignments' && <Assignments canEdit={canTrain} />}
      </div>
    </div>
  )
}

function JoinOrRegister({ onDone }: { onDone: () => void }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold sm:text-[28px]">Join your chapter</h1>
      <p className="mt-1.5 text-ink-3">Your chapter gets its own leaderboard, classroom and trainers.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <form className="surface p-6" onSubmit={(e) => { e.preventDefault(); onDone() }}>
          <h2 className="font-semibold">Have a code?</h2>
          <p className="mt-1 text-sm text-ink-3">Get it from your chapter president, or open their invite link.</p>
          <label className="field-label mt-5" htmlFor="code">Chapter code</label>
          <input id="code" className="input num uppercase" placeholder="LINC-7Q4K" />
          <button className="btn-primary mt-4 w-full">Join chapter</button>
        </form>
        <form className="surface p-6" onSubmit={(e) => { e.preventDefault(); onDone() }}>
          <h2 className="font-semibold">Register a new chapter</h2>
          <p className="mt-1 text-sm text-ink-3">For presidents. You’ll get a code and invite link to share.</p>
          <div className="mt-5 space-y-3">
            <div><label className="field-label" htmlFor="cname">Chapter name</label><input id="cname" className="input" /></div>
            <div><label className="field-label" htmlFor="school">School</label><input id="school" className="input" /></div>
            <div><label className="field-label" htmlFor="advisor">Advisor email</label><input id="advisor" type="email" className="input" /></div>
          </div>
          <button className="btn-secondary mt-4 w-full">Create chapter</button>
        </form>
      </div>
    </div>
  )
}

function Classroom({ canPost, isPresident }: { canPost: boolean; isPresident: boolean }) {
  const [posts, setPosts] = useState<{ id: string; type: string; author: string; role: string; title: string; body: string; url?: string; date: string }[]>(ANNOUNCEMENTS)
  const [kind, setKind] = useState<'Announcement' | 'Link' | 'Newsletter'>('Announcement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [digest, setDigest] = useState(true)
  const [nudge, setNudge] = useState(true)
  const kinds = isPresident ? (['Announcement', 'Link', 'Newsletter'] as const) : (['Announcement', 'Link'] as const)

  const post = () => {
    if (!title.trim()) return
    const isLink = kind === 'Link'
    setPosts([{ id: `a${Date.now()}`, type: kind, author: ME.name, role: isPresident ? 'President' : 'Trainer', title, body: isLink ? '' : body, url: isLink ? body : undefined, date: 'Just now' }, ...posts])
    setTitle('')
    setBody('')
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <div className="space-y-4">
        {canPost && (
          <div className="surface p-4">
            <div className="flex gap-1">
              {kinds.map((k) => (
                <button key={k} onClick={() => setKind(k)} className={`rounded-md px-2.5 py-1 text-[13px] font-medium ${kind === k ? 'bg-tint text-brand' : 'text-ink-3 hover:text-ink'}`}>{k}</button>
              ))}
            </div>
            <label className="sr-only" htmlFor="post-title">Title</label>
            <input id="post-title" className="input mt-3" placeholder={kind === 'Newsletter' ? 'Newsletter title' : 'Title'} value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="sr-only" htmlFor="post-body">{kind === 'Link' ? 'URL' : 'Message'}</label>
            {kind === 'Link' ? (
              <input id="post-body" className="input mt-2" placeholder="https://" value={body} onChange={(e) => setBody(e.target.value)} />
            ) : (
              <textarea id="post-body" rows={3} className="input mt-2 resize-none" placeholder="Write to your chapter" value={body} onChange={(e) => setBody(e.target.value)} />
            )}
            <div className="mt-3 flex justify-end"><button className="btn-primary btn-sm" onClick={post} disabled={!title.trim()}>Post</button></div>
          </div>
        )}

        <ul className="space-y-3">
          {posts.map((a) => {
            const Icon = a.type === 'Link' ? LinkSimple : a.type === 'Newsletter' ? Newspaper : Megaphone
            return (
              <li key={a.id} className="surface p-5">
                <div className="flex items-center gap-2.5">
                  <Avatar name={a.author} size={28} />
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{a.author}</span>
                    <span className="text-ink-3">, {a.role}</span>
                  </div>
                  <span className="badge-neutral"><Icon size={13} /> {a.type}</span>
                </div>
                <h3 className="mt-3 font-semibold">{a.title}</h3>
                {a.body && <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-ink-2">{a.body}</p>}
                {a.url && (
                  <a href={a.url} target="_blank" rel="noreferrer" className="link mt-2 inline-flex items-center gap-1 text-sm">
                    {a.url.replace(/^https?:\/\//, '')} <ArrowSquareOut size={14} />
                  </a>
                )}
                <p className="mt-3 text-xs text-ink-3">{a.date}</p>
              </li>
            )
          })}
        </ul>
      </div>

      <aside className="space-y-6">
        <section className="surface p-5">
          <h2 className="h-section flex items-center gap-2"><EnvelopeSimple size={17} className="text-brand" /> Emails</h2>
          <p className="mt-1 text-xs text-ink-3">{isPresident ? 'Sent to every member automatically.' : 'Only the president can change these.'}</p>
          <SettingRow title="Weekly overview" body="Mondays: assignments due, events, chapter rank." on={digest} set={setDigest} disabled={!isPresident} />
          <SettingRow title="Inactivity reminder" body="After 7 days without practice." on={nudge} set={setNudge} disabled={!isPresident} />
        </section>
        <InviteCard />
      </aside>
    </div>
  )
}

function SettingRow({ title, body, on, set, disabled }: { title: string; body: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="mt-4 flex items-start justify-between gap-4 border-t border-line pt-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-ink-3">{body}</p>
      </div>
      <Toggle on={on} onChange={set} disabled={disabled} label={title} />
    </div>
  )
}

function InviteCard() {
  const [copied, setCopied] = useState('')
  const link = `decamasters.app/join/${CODE}`
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v)
    setCopied(v)
    setTimeout(() => setCopied(''), 1500)
  }
  return (
    <section className="surface p-5">
      <h2 className="h-section flex items-center gap-2"><UserPlus size={17} className="text-brand" /> Invite</h2>
      {[['Code', CODE], ['Link', link]].map(([label, v]) => (
        <div key={label} className="mt-4">
          <p className="field-label">{label}</p>
          <div className="flex gap-2">
            <code className="num flex h-9 min-w-0 flex-1 items-center truncate rounded-lg bg-canvas px-3 text-[13px] text-ink-2">{v}</code>
            <button className="btn-secondary w-9 px-0" onClick={() => copy(v)} aria-label={`Copy ${label.toLowerCase()}`}>
              {copied === v ? <Check size={15} className="text-good" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      ))}
      <label className="field-label mt-4" htmlFor="invite-user">Invite by username</label>
      <div className="flex gap-2">
        <input id="invite-user" className="input h-9" placeholder="username" />
        <button className="btn-secondary h-9">Send</button>
      </div>
    </section>
  )
}

function ChapterBoard() {
  const members = chapterPlayers()
  const total = members.reduce((s, p) => s + p.elo, 0)
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
      <section className="surface p-2">
        {members.map((p, i) => <RankRow key={p.id} p={p} rank={i + 1} me={p.id === ME.id} />)}
      </section>
      <aside className="space-y-6">
        <Stat label="Chapter ELO" value={total.toLocaleString()} hint="Sum of every member" />
        <Stat label="Chapter rank" value="#1" hint="Out of 6 chapters" />
        <p className="text-sm text-ink-3">New members start at 0 ELO. Every correct answer moves them up.</p>
      </aside>
    </div>
  )
}

function Members({ isAdmin }: { isAdmin: boolean }) {
  const [roles, setRoles] = useState<Record<string, Role>>({ p0: 'President', p2: 'Executive', p5: 'Trainer' })
  const [members, setMembers] = useState<Player[]>(chapterPlayers())
  const [banned, setBanned] = useState<Player[]>([])
  return (
    <div className="space-y-4">
      <div className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-2.5 font-medium">Member</th>
              <th className="px-4 py-2.5 font-medium">Role</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">ELO</th>
              {isAdmin && <th className="px-4 py-2.5 text-right font-medium"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((p) => {
              const role = roles[p.id] ?? 'Member'
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} size={30} />
                      <div>
                        <p className="font-medium">{p.name}</p>
                        <p className="text-xs text-ink-3">Grade {p.grade}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && role !== 'President' ? (
                      <select aria-label={`Role for ${p.name}`} className="input h-8 w-auto text-[13px]" value={role} onChange={(e) => setRoles({ ...roles, [p.id]: e.target.value as Role })}>
                        {(['Executive', 'Trainer', 'Member'] as Role[]).map((r) => <option key={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className={role === 'Member' ? 'badge-neutral' : 'badge'}>{role === 'President' && <ShieldCheck size={13} />}{role}</span>
                    )}
                  </td>
                  <td className="num hidden px-4 py-3 sm:table-cell">{p.elo.toLocaleString()}</td>
                  {isAdmin && (
                    <td className="px-4 py-3 text-right">
                      {role !== 'President' && (
                        <div className="inline-flex gap-1">
                          <button className="btn-ghost btn-sm w-8 px-0" title="Remove" aria-label={`Remove ${p.name}`} onClick={() => setMembers(members.filter((m) => m.id !== p.id))}><UserMinus size={16} /></button>
                          <button className="btn-ghost btn-sm w-8 px-0 hover:bg-bad-bg hover:text-bad" title="Ban" aria-label={`Ban ${p.name}`} onClick={() => { setMembers(members.filter((m) => m.id !== p.id)); setBanned([...banned, p]) }}><Prohibit size={16} /></button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {banned.length > 0 && (
        <p className="text-sm text-ink-3">
          <span className="font-medium text-bad">Banned:</span> {banned.map((b) => b.name).join(', ')}
          <button className="link ml-2" onClick={() => { setMembers([...members, ...banned]); setBanned([]) }}>Undo</button>
        </p>
      )}
    </div>
  )
}

function Trainers({ isAdmin }: { isAdmin: boolean }) {
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
    <div>
      <p className="mb-4 text-sm text-ink-3">Each event can have up to two trainers. Trainers can post to the classroom and assign work for their event.</p>
      <ul className="surface divide-y divide-line">
        {EVENTS.map((e) => (
          <li key={e.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
            <div className="sm:w-56">
              <p className="font-medium">{e.name}</p>
              <p className="num text-xs text-ink-3">{trainers[e.id].length}/2 trainers</p>
            </div>
            <div className="flex flex-1 flex-wrap gap-1.5">
              {members.map((p) => {
                const on = trainers[e.id].includes(p.id)
                if (!isAdmin && !on) return null
                const full = !on && trainers[e.id].length >= 2
                return (
                  <button
                    key={p.id}
                    disabled={!isAdmin || full}
                    onClick={() => toggle(e.id, p.id)}
                    className={`inline-flex items-center gap-1.5 rounded-md border py-1 pl-1 pr-2.5 text-[13px] transition-colors disabled:cursor-default ${
                      on ? 'border-brand/40 bg-tint font-medium text-brand' : 'border-line text-ink-3 hover:border-line-strong hover:text-ink disabled:opacity-40'
                    }`}
                  >
                    <Avatar name={p.name} size={20} />
                    {p.name.split(' ')[0]}
                  </button>
                )
              })}
              {!isAdmin && trainers[e.id].length === 0 && <span className="text-sm text-ink-3">No trainer assigned</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Attendance() {
  const members = chapterPlayers()
  const [present, setPresent] = useState<Set<string>>(new Set(members.map((m) => m.id)))
  const [saved, setSaved] = useState(false)
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_280px]">
      <section className="surface">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="h-section">Meeting, Oct 10</h2>
            <p className="num text-sm text-ink-3">{present.size} of {members.length} present</p>
          </div>
          <button className="btn-primary btn-sm" onClick={() => setSaved(true)}>{saved ? <><Check size={15} /> Saved</> : 'Save'}</button>
        </div>
        <ul className="divide-y divide-line">
          {members.map((p) => {
            const here = present.has(p.id)
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                <Avatar name={p.name} size={28} />
                <span className="flex-1 text-sm">{p.name}</span>
                <div className="inline-flex rounded-lg border border-line p-0.5 text-[13px]">
                  {(['Present', 'Absent'] as const).map((s) => {
                    const active = (s === 'Present') === here
                    return (
                      <button
                        key={s}
                        onClick={() => { const n = new Set(present); s === 'Present' ? n.add(p.id) : n.delete(p.id); setPresent(n); setSaved(false) }}
                        className={`rounded-md px-2.5 py-1 font-medium ${active ? (s === 'Present' ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad') : 'text-ink-3'}`}
                      >
                        {s}
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </section>
      <aside>
        <h2 className="h-section mb-4">Past meetings</h2>
        <ul className="space-y-4">
          {ATTENDANCE.map((a) => (
            <li key={a.date}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span className="text-ink-2">{a.date}</span>
                <span className="num">{a.present}/{a.total}</span>
              </div>
              <Meter value={(a.present / a.total) * 100} />
            </li>
          ))}
        </ul>
      </aside>
    </div>
  )
}

function Insights() {
  const members = chapterPlayers()
  // Mock per-member weak areas derived from the demo stats.
  const weak = (i: number) => [...MY_STATS.bySection].sort((a, b) => ((a.accuracy * (i + 3)) % 17) - ((b.accuracy * (i + 3)) % 17))[0]
  return (
    <div className="space-y-8">
      <section className="surface grid grid-cols-2 gap-y-6 p-5 sm:p-6 md:grid-cols-4 md:divide-x md:divide-line">
        <div className="md:pr-6"><Stat label="Average accuracy" value="76%" /></div>
        <div className="md:px-6"><Stat label="Active this week" value={`${members.length - 1}/${members.length}`} /></div>
        <div className="md:px-6"><Stat label="Attendance" value="88%" hint="Last 4 meetings" /></div>
        <div className="md:pl-6"><Stat label="Weakest event" value="Finance" hint="69% chapter average" /></div>
      </section>
      <section className="surface overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="px-4 py-2.5 font-medium">Member</th>
              <th className="px-4 py-2.5 font-medium">ELO</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Questions</th>
              <th className="px-4 py-2.5 font-medium">Needs work</th>
              <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Attendance</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {members.map((p, i) => {
              const w = weak(i)
              const stale = i === 3
              return (
                <tr key={p.id}>
                  <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Avatar name={p.name} size={26} /><span className="font-medium">{p.name}</span></div></td>
                  <td className="num px-4 py-3">{p.elo.toLocaleString()}</td>
                  <td className="num hidden px-4 py-3 text-ink-2 md:table-cell">{(900 + i * 137).toLocaleString()}</td>
                  <td className="px-4 py-3 text-ink-2">{eventName(w.event)} <span className="num text-ink-3">{w.accuracy - i}%</span></td>
                  <td className="num hidden px-4 py-3 text-ink-2 sm:table-cell">{95 - i * 4}%</td>
                  <td className={`hidden px-4 py-3 md:table-cell ${stale ? 'font-medium text-bad' : 'text-ink-2'}`}>{stale ? '9 days ago' : `${i + 1}h ago`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>
    </div>
  )
}

function Assignments({ canEdit }: { canEdit: boolean }) {
  const [questions, setQuestions] = useState(QUESTIONS.slice(0, 5))
  const [editing, setEditing] = useState<string | null>(null)
  const [items, setItems] = useState([
    { title: 'Ratios flashcard set', type: 'Flashcards', event: 'finance' as EventId, due: 'Oct 12', done: 14 },
    { title: 'Marketing mock exam (shuffled)', type: 'Test', event: 'marketing' as EventId, due: 'Oct 15', done: 9 },
  ])
  const [newTitle, setNewTitle] = useState('')
  const [newType, setNewType] = useState('Test')
  const [newEvent, setNewEvent] = useState<EventId>('core')

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <div className="space-y-6">
        <section>
          <h2 className="h-section mb-3">Assigned</h2>
          <ul className="surface divide-y divide-line">
            {items.map((a) => (
              <li key={a.title} className="flex items-center gap-4 px-5 py-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.title}</p>
                  <p className="text-xs text-ink-3">{a.type}, {eventName(a.event)}, due {a.due}</p>
                </div>
                <span className="num text-sm text-ink-2">{a.done} done</span>
              </li>
            ))}
          </ul>
        </section>
        {canEdit && (
          <form className="surface space-y-3 p-5" onSubmit={(e) => { e.preventDefault(); if (newTitle.trim()) { setItems([...items, { title: newTitle, type: newType, event: newEvent, due: 'Oct 20', done: 0 }]); setNewTitle('') } }}>
            <h2 className="h-section">New assignment</h2>
            <div><label className="field-label" htmlFor="as-title">Title</label><input id="as-title" className="input" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="field-label" htmlFor="as-type">Type</label>
                <select id="as-type" className="input" value={newType} onChange={(e) => setNewType(e.target.value)}><option>Test</option><option>Flashcards</option><option>Shuffled exam</option></select>
              </div>
              <div>
                <label className="field-label" htmlFor="as-event">Event</label>
                <select id="as-event" className="input" value={newEvent} onChange={(e) => setNewEvent(e.target.value as EventId)}>{EVENTS.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
              </div>
            </div>
            <button className="btn-primary" disabled={!newTitle.trim()}><Plus size={15} /> Assign to chapter</button>
          </form>
        )}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="h-section">Test builder</h2>
          {canEdit && <button className="btn-secondary btn-sm" onClick={() => setQuestions([...questions].sort(() => Math.random() - 0.5))}><Shuffle size={15} /> Shuffle</button>}
        </div>
        <ol className="surface divide-y divide-line">
          {questions.map((q, i) => (
            <li key={q.id} className="flex gap-3 px-5 py-4 text-sm">
              <span className="num pt-px text-ink-3">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                {editing === q.id ? (
                  <textarea
                    aria-label="Question text"
                    rows={3}
                    className="input resize-none"
                    value={q.prompt}
                    onChange={(e) => setQuestions(questions.map((x) => (x.id === q.id ? { ...x, prompt: e.target.value } : x)))}
                  />
                ) : (
                  <p>{q.prompt}</p>
                )}
                <p className="mt-1.5 text-xs text-ink-3">Answer: {q.choices[q.answer]}</p>
              </div>
              {canEdit && (
                <button className="btn-ghost btn-sm h-7 w-7 shrink-0 px-0" onClick={() => setEditing(editing === q.id ? null : q.id)} aria-label={editing === q.id ? 'Done editing' : 'Edit question'}>
                  {editing === q.id ? <Check size={15} /> : <PencilSimple size={15} />}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
