import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Copy, Check, LinkSimple, Megaphone, Newspaper, UserMinus, Prohibit, EnvelopeSimple, Plus, Shuffle, PencilSimple, ShieldCheck, ArrowSquareOut, UserPlus, UsersThree, ClipboardText, CalendarBlank } from '@phosphor-icons/react'
import { CLUSTERS, EXAMS, examOf, eventByCode, type ExamId } from '../data/events'
import { sample, useQuestions, type Question } from '../data/questions'
import { useStore, type Assignment, type ChapterMeta, type ChapterRow, type Post, type Role } from '../store'
import { Avatar, EmptyState, Meter, PageBand, RankRow, SectionHeader, Stat, Toggle } from '../components/ui'

const TABS = ['Classroom', 'Leaderboard', 'Members', 'Trainers', 'Attendance', 'Insights', 'Assignments'] as const
type Tab = (typeof TABS)[number]
const today = () => new Date().toISOString().slice(0, 10)
const fmtDate = (d: string) => new Date(d.length === 10 ? d + 'T12:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function Chapter() {
  const { isGuest, me, myChapter, chapterMeta, updateMeta, leaveChapter } = useStore()
  const [tab, setTab] = useState<Tab>('Classroom')
  const [copied, setCopied] = useState(false)

  if (isGuest)
    return (
      <div>
        <PageBand tag="Chapters" title="Chapter" description="Chapters have their own leaderboard, classroom, trainers and attendance." />
        <div className="panel">
          <EmptyState icon={<UsersThree size={22} />} title="Chapters need an account" body="Create an account, then join your chapter with its code or start one for your school." action={<Link to="/register" className="btn-primary">Create account</Link>} />
        </div>
      </div>
    )
  if (!myChapter) return <JoinOrCreate />

  const meta = chapterMeta(myChapter.id)
  const role: Role = meta.roles[me!.id] ?? 'Member'
  const isAdmin = role === 'President' || role === 'Executive'
  const canTrain = isAdmin || role === 'Trainer'
  const visible = TABS.filter((t) => (t === 'Insights' ? isAdmin : t === 'Attendance' ? canTrain : true))
  const current = visible.includes(tab) ? tab : 'Classroom'
  const update = (fn: (m: ChapterMeta) => ChapterMeta) => updateMeta(myChapter.id, fn)

  const copyCode = () => {
    navigator.clipboard?.writeText(myChapter.code)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div>
      <PageBand
        tag={role}
        title={myChapter.name}
        description={`${myChapter.school}, ${myChapter.members.length} ${myChapter.members.length === 1 ? 'member' : 'members'}. Join code ${myChapter.code}.`}
        actions={
          <>
            <button className="btn-white" onClick={copyCode}>{copied ? <><Check size={16} /> Copied</> : <><Copy size={16} /> Copy code</>}</button>
            <button className="btn-outline-white" onClick={() => { if (confirm(`Leave ${myChapter.name}?`)) leaveChapter() }}>Leave</button>
          </>
        }
      />

      <nav className="mb-10 flex gap-8 overflow-x-auto border-b border-line" aria-label="Chapter sections">
        {visible.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${current === t ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink'}`}
          >
            {t}
          </button>
        ))}
      </nav>

      <div key={current} className="enter">
        {current === 'Classroom' && <Classroom chapter={myChapter} meta={meta} update={update} role={role} canPost={canTrain} />}
        {current === 'Leaderboard' && <ChapterBoard chapter={myChapter} />}
        {current === 'Members' && <Members chapter={myChapter} meta={meta} update={update} isAdmin={isAdmin} />}
        {current === 'Trainers' && <Trainers chapter={myChapter} meta={meta} update={update} isAdmin={isAdmin} />}
        {current === 'Attendance' && <Attendance chapter={myChapter} meta={meta} update={update} />}
        {current === 'Insights' && <Insights chapter={myChapter} meta={meta} />}
        {current === 'Assignments' && <Assignments meta={meta} update={update} canEdit={canTrain} />}
      </div>
    </div>
  )
}

function JoinOrCreate() {
  const { me, joinChapter, createChapter } = useStore()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [school, setSchool] = useState(me!.school)

  const join = (e: FormEvent) => {
    e.preventDefault()
    setError(joinChapter(code) ?? '')
  }
  const create = (e: FormEvent) => {
    e.preventDefault()
    if (name.trim() && school.trim()) createChapter(name, school)
  }

  return (
    <div>
      <PageBand tag="Chapters" title="Join your chapter" description="Enter the code from your chapter president, or create a chapter for your school and invite your members." />
      <div className="grid gap-6 md:grid-cols-2">
        <form className="panel p-8" onSubmit={join}>
          <h2 className="text-xl text-brand">Have a code?</h2>
          <p className="mt-1 text-sm text-ink-3">Codes look like LINC-7Q4K.</p>
          <label className="field-label mt-6" htmlFor="code">Chapter code</label>
          <input id="code" className="input uppercase" value={code} onChange={(e) => { setCode(e.target.value); setError('') }} placeholder="XXXX-XXXX" required />
          {error && <p role="alert" className="mt-3 text-sm font-medium text-bad">{error}</p>}
          <button className="btn-primary mt-5">Join chapter</button>
        </form>
        <form className="panel p-8" onSubmit={create}>
          <h2 className="text-xl text-brand">Create a chapter</h2>
          <p className="mt-1 text-sm text-ink-3">You become its president and get a code to share.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="field-label" htmlFor="cname">Chapter name</label>
              <input id="cname" className="input" placeholder="e.g. Lincoln DECA" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="field-label" htmlFor="cschool">School</label>
              <input id="cschool" className="input" value={school} onChange={(e) => setSchool(e.target.value)} required />
            </div>
          </div>
          <button className="btn-secondary mt-5">Create chapter</button>
        </form>
      </div>
    </div>
  )
}

type Props = { chapter: ChapterRow; meta: ChapterMeta; update: (fn: (m: ChapterMeta) => ChapterMeta) => void }

function Classroom({ chapter, meta, update, role, canPost }: Props & { role: Role; canPost: boolean }) {
  const { me } = useStore()
  const isPresident = role === 'President'
  const [kind, setKind] = useState<Post['type']>('Announcement')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [copied, setCopied] = useState('')
  const kinds: Post['type'][] = isPresident ? ['Announcement', 'Link', 'Newsletter'] : ['Announcement', 'Link']
  const invite = `${location.origin}/register?chapter=${chapter.code}`

  const post = () => {
    if (!title.trim()) return
    const isLink = kind === 'Link'
    const p: Post = { id: Math.random().toString(36).slice(2), type: kind, authorId: me!.id, author: me!.name, role, title: title.trim(), body: isLink ? '' : body.trim(), url: isLink ? body.trim() : undefined, date: new Date().toISOString() }
    update((m) => ({ ...m, posts: [p, ...m.posts] }))
    setTitle('')
    setBody('')
  }
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v)
    setCopied(v)
    setTimeout(() => setCopied(''), 1500)
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {canPost && (
          <div className="surface p-5">
            <div className="flex gap-1">
              {kinds.map((k) => (
                <button key={k} onClick={() => setKind(k)} className={`rounded-soft px-2.5 py-1 text-[13px] font-semibold ${kind === k ? 'bg-tint text-brand' : 'text-ink-3 hover:text-ink'}`}>{k}</button>
              ))}
            </div>
            <label className="sr-only" htmlFor="post-title">Title</label>
            <input id="post-title" className="input mt-3" placeholder={kind === 'Newsletter' ? 'Newsletter title' : 'Title'} value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="sr-only" htmlFor="post-body">{kind === 'Link' ? 'URL' : 'Message'}</label>
            {kind === 'Link' ? (
              <input id="post-body" type="url" className="input mt-2" placeholder="https://" value={body} onChange={(e) => setBody(e.target.value)} />
            ) : (
              <textarea id="post-body" rows={3} className="input mt-2 resize-none" placeholder="Write to your chapter" value={body} onChange={(e) => setBody(e.target.value)} />
            )}
            <div className="mt-3 flex justify-end"><button className="btn-primary btn-sm" onClick={post} disabled={!title.trim()}>Post</button></div>
          </div>
        )}

        {meta.posts.length === 0 ? (
          <div className="panel"><EmptyState icon={<Megaphone size={22} />} title="No posts yet" body={canPost ? 'Post an announcement, a link or a weekly newsletter for your members.' : 'Announcements from your chapter officers will show up here.'} /></div>
        ) : (
          <ul className="space-y-3">
            {meta.posts.map((a) => {
              const Icon = a.type === 'Link' ? LinkSimple : a.type === 'Newsletter' ? Newspaper : Megaphone
              return (
                <li key={a.id} className="panel p-6">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={a.author} size={28} />
                    <div className="min-w-0 flex-1 text-sm">
                      <span className="font-semibold text-ink">{a.author}</span>
                      <span className="text-ink-3">, {a.role}</span>
                    </div>
                    <span className="badge-neutral"><Icon size={13} /> {a.type}</span>
                  </div>
                  <h3 className="mt-4 text-lg text-brand">{a.title}</h3>
                  {a.body && <p className="mt-1 max-w-[65ch] whitespace-pre-line text-sm leading-relaxed text-ink-2">{a.body}</p>}
                  {a.url && (
                    <a href={a.url} target="_blank" rel="noreferrer" className="link mt-2 inline-flex items-center gap-1 text-sm">
                      {a.url.replace(/^https?:\/\//, '')} <ArrowSquareOut size={14} />
                    </a>
                  )}
                  <p className="mt-3 text-xs text-ink-3">{fmtDate(a.date)}</p>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <aside className="space-y-6">
        <section className="surface p-5">
          <h2 className="h-section flex items-center gap-2"><UserPlus size={18} className="text-brand" /> Invite members</h2>
          {[['Join code', chapter.code], ['Invite link', invite]].map(([label, v]) => (
            <div key={label} className="mt-4">
              <p className="field-label">{label}</p>
              <div className="flex gap-2">
                <code className="flex h-10 min-w-0 flex-1 items-center truncate rounded-soft bg-canvas px-3 text-[13px] text-ink-2">{v}</code>
                <button className="btn-secondary w-10 px-0" onClick={() => copy(v)} aria-label={`Copy ${label.toLowerCase()}`}>
                  {copied === v ? <Check size={16} /> : <Copy size={16} />}
                </button>
              </div>
            </div>
          ))}
        </section>
        <section className="surface p-5">
          <h2 className="h-section flex items-center gap-2"><EnvelopeSimple size={18} className="text-brand" /> Emails</h2>
          <p className="mt-1 text-xs text-ink-3">{isPresident ? 'Sent to every member once email sending is switched on.' : 'Only the president can change these.'}</p>
          <SettingRow title="Weekly overview" body="Mondays: assignments due, events and chapter rank." on={meta.digest} set={(v) => update((m) => ({ ...m, digest: v }))} disabled={!isPresident} />
          <SettingRow title="Inactivity reminder" body="After 7 days without practice." on={meta.nudge} set={(v) => update((m) => ({ ...m, nudge: v }))} disabled={!isPresident} />
        </section>
      </aside>
    </div>
  )
}

function SettingRow({ title, body, on, set, disabled }: { title: string; body: string; on: boolean; set: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="mt-4 flex items-start justify-between gap-4 border-t border-line pt-4">
      <div>
        <p className="text-sm font-semibold text-ink">{title}</p>
        <p className="text-xs text-ink-3">{body}</p>
      </div>
      <Toggle on={on} onChange={set} disabled={disabled} label={title} />
    </div>
  )
}

function ChapterBoard({ chapter }: { chapter: ChapterRow }) {
  const ranked = [...chapter.members].sort((a, b) => b.elo - a.elo)
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
      <div className="divide-y divide-line border border-line">
        {ranked.map((p, i) => <RankRow key={p.id} p={p} rank={p.elo > 0 ? i + 1 : 0} />)}
      </div>
      <aside className="space-y-8">
        <Stat label="Chapter ELO" value={chapter.totalElo.toLocaleString()} hint="Sum of every member" />
        <Stat label="Members" value={chapter.members.length} />
        <p className="text-sm text-ink-3">New members start at 0 ELO. Every correct answer moves them up.</p>
      </aside>
    </div>
  )
}

function Members({ chapter, meta, update, isAdmin }: Props & { isAdmin: boolean }) {
  const { me, players } = useStore()
  const gone = players.filter((p) => meta.removed.includes(p.id) || meta.banned.includes(p.id))
  return (
    <div className="space-y-6">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="py-3 pr-4">Member</th>
              <th className="py-3 pr-4">Role</th>
              <th className="hidden py-3 pr-4 sm:table-cell">Event</th>
              <th className="hidden py-3 pr-4 sm:table-cell">ELO</th>
              {isAdmin && <th className="py-3"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {chapter.members.map((p) => {
              const role = meta.roles[p.id] ?? 'Member'
              const locked = role === 'President' || p.id === me!.id
              return (
                <tr key={p.id}>
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.name} size={30} />
                      <div>
                        <p className="font-semibold text-ink">{p.name}{p.isMe && <span className="ml-1.5 text-xs font-medium text-ink-3">(you)</span>}</p>
                        <p className="text-xs text-ink-3">Grade {p.grade}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4">
                    {isAdmin && !locked ? (
                      <select aria-label={`Role for ${p.name}`} className="input h-8 w-auto text-[13px]" value={role} onChange={(e) => update((m) => ({ ...m, roles: { ...m.roles, [p.id]: e.target.value as Role } }))}>
                        {(['Executive', 'Trainer', 'Member'] as Role[]).map((r) => <option key={r}>{r}</option>)}
                      </select>
                    ) : (
                      <span className={role === 'Member' ? 'badge-neutral' : 'badge'}>{role === 'President' && <ShieldCheck size={13} />}{role}</span>
                    )}
                  </td>
                  <td className="hidden py-3 pr-4 text-ink-2 sm:table-cell">{p.eventCode}</td>
                  <td className="num hidden py-3 pr-4 font-semibold text-ink sm:table-cell">{p.elo.toLocaleString()}</td>
                  {isAdmin && (
                    <td className="py-3 text-right">
                      {!locked && (
                        <div className="inline-flex gap-1">
                          <button className="btn-ghost btn-sm w-8 px-0" title="Remove" aria-label={`Remove ${p.name}`} onClick={() => update((m) => ({ ...m, removed: [...m.removed, p.id] }))}><UserMinus size={16} /></button>
                          <button className="btn-ghost btn-sm w-8 px-0 hover:bg-bad-bg hover:text-bad" title="Ban" aria-label={`Ban ${p.name}`} onClick={() => update((m) => ({ ...m, banned: [...m.banned, p.id] }))}><Prohibit size={16} /></button>
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
      {isAdmin && gone.length > 0 && (
        <div className="panel p-5">
          <p className="text-sm font-semibold text-ink">Removed and banned</p>
          <ul className="mt-3 space-y-2">
            {gone.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-ink-2">{p.name} <span className="text-xs text-ink-3">({meta.banned.includes(p.id) ? 'banned' : 'removed'})</span></span>
                <button className="link text-sm" onClick={() => update((m) => ({ ...m, removed: m.removed.filter((x) => x !== p.id), banned: m.banned.filter((x) => x !== p.id) }))}>Restore</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Trainers({ chapter, meta, update, isAdmin }: Props & { isAdmin: boolean }) {
  return (
    <div>
      <p className="mb-6 text-sm text-ink-3">Each career cluster can have up to two trainers. Trainers can post to the classroom and assign work.</p>
      <ul className="divide-y divide-line border border-line">
        {CLUSTERS.map((c) => {
          const ids = meta.trainers[c.id] ?? []
          return (
            <li key={c.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
              <div className="sm:w-72">
                <p className="flex items-center gap-2.5 font-semibold text-ink"><span className="h-3 w-3" style={{ background: c.color }} aria-hidden />{c.name}</p>
                <p className="num text-xs text-ink-3">{ids.length}/2 trainers</p>
              </div>
              <div className="flex flex-1 flex-wrap gap-1.5">
                {chapter.members.map((p) => {
                  const on = ids.includes(p.id)
                  if (!isAdmin && !on) return null
                  const full = !on && ids.length >= 2
                  return (
                    <button
                      key={p.id}
                      disabled={!isAdmin || full}
                      onClick={() => update((m) => ({ ...m, trainers: { ...m.trainers, [c.id]: on ? ids.filter((x) => x !== p.id) : [...ids, p.id] } }))}
                      className={`inline-flex items-center gap-1.5 rounded-soft border py-1 pl-1 pr-2.5 text-[13px] transition-colors disabled:cursor-default ${on ? 'border-brand bg-tint font-semibold text-brand' : 'border-line text-ink-3 hover:border-line-strong hover:text-ink disabled:opacity-40'}`}
                    >
                      <Avatar name={p.name} size={20} />
                      {p.name.split(' ')[0]}
                    </button>
                  )
                })}
                {!isAdmin && ids.length === 0 && <span className="text-sm text-ink-3">No trainer assigned</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Attendance({ chapter, meta, update }: Props) {
  const day = today()
  const [present, setPresent] = useState<Set<string>>(new Set(meta.attendance[day] ?? []))
  const [saved, setSaved] = useState(!!meta.attendance[day])
  const past = Object.entries(meta.attendance).filter(([d]) => d !== day).sort(([a], [b]) => b.localeCompare(a))
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
      <section className="border border-line">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="h-section">Meeting, {fmtDate(day)}</h2>
            <p className="num text-sm text-ink-3">{present.size} of {chapter.members.length} marked present</p>
          </div>
          <button className="btn-primary btn-sm" onClick={() => { update((m) => ({ ...m, attendance: { ...m.attendance, [day]: [...present] } })); setSaved(true) }}>
            {saved ? <><Check size={15} /> Saved</> : 'Save'}
          </button>
        </div>
        <ul className="divide-y divide-line">
          {chapter.members.map((p) => {
            const here = present.has(p.id)
            return (
              <li key={p.id} className="flex items-center gap-3 px-5 py-2.5">
                <Avatar name={p.name} size={28} />
                <span className="flex-1 text-sm text-ink">{p.name}</span>
                <div className="inline-flex rounded-soft border border-line p-0.5 text-[13px]">
                  {(['Present', 'Absent'] as const).map((s) => {
                    const active = (s === 'Present') === here
                    return (
                      <button
                        key={s}
                        onClick={() => { const n = new Set(present); if (s === 'Present') n.add(p.id); else n.delete(p.id); setPresent(n); setSaved(false) }}
                        className={`rounded-soft px-2.5 py-1 font-semibold ${active ? (s === 'Present' ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad') : 'text-ink-3'}`}
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
        <SectionHeader title="Past meetings" />
        {past.length === 0 ? (
          <p className="text-sm text-ink-3">Saved meetings will appear here.</p>
        ) : (
          <ul className="space-y-4">
            {past.map(([d, ids]) => (
              <li key={d}>
                <div className="mb-1.5 flex justify-between text-sm">
                  <span className="text-ink-2">{fmtDate(d)}</span>
                  <span className="num font-semibold text-ink">{ids.length}/{chapter.members.length}</span>
                </div>
                <Meter value={(ids.length / Math.max(1, chapter.members.length)) * 100} />
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}

function Insights({ chapter, meta }: { chapter: ChapterRow; meta: ChapterMeta }) {
  const m = chapter.members
  const answered = m.filter((p) => p.questions > 0)
  const avgAcc = answered.length ? Math.round(answered.reduce((s, p) => s + p.accuracy, 0) / answered.length) : 0
  const active = m.filter((p) => p.lastActiveDays <= 7).length
  const meetings = Object.values(meta.attendance)
  const attendance = meetings.length && m.length ? Math.round((meetings.reduce((s, ids) => s + ids.length, 0) / (meetings.length * m.length)) * 100) : null
  const byCluster = CLUSTERS.map((c) => ({ c, n: m.filter((p) => eventByCode(p.eventCode)?.cluster === c.id).length })).sort((a, b) => b.n - a.n)
  const attended = (id: string) => (meetings.length ? Math.round((meetings.filter((ids) => ids.includes(id)).length / meetings.length) * 100) : null)

  return (
    <div className="space-y-10">
      <section className="grid grid-cols-2 gap-px border border-line bg-line md:grid-cols-4">
        <div className="bg-white p-6"><Stat label="Average accuracy" value={`${avgAcc}%`} /></div>
        <div className="bg-white p-6"><Stat label="Active this week" value={`${active}/${m.length}`} /></div>
        <div className="bg-white p-6"><Stat label="Attendance" value={attendance === null ? '0%' : `${attendance}%`} hint={`${meetings.length} meetings recorded`} /></div>
        <div className="bg-white p-6"><Stat label="Biggest cluster" value={byCluster[0]?.n ? byCluster[0].c.short.split(' ')[0] : 'None'} hint={byCluster[0]?.n ? `${byCluster[0].n} members` : undefined} /></div>
      </section>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="table-head">
            <tr>
              <th className="py-3 pr-4">Member</th>
              <th className="py-3 pr-4">ELO</th>
              <th className="hidden py-3 pr-4 md:table-cell">Questions</th>
              <th className="py-3 pr-4">Accuracy</th>
              <th className="hidden py-3 pr-4 sm:table-cell">Attendance</th>
              <th className="hidden py-3 pr-4 md:table-cell">Last active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {m.map((p) => {
              const att = attended(p.id)
              return (
                <tr key={p.id}>
                  <td className="py-3 pr-4"><div className="flex items-center gap-2.5"><Avatar name={p.name} size={26} /><span className="font-semibold text-ink">{p.name}</span></div></td>
                  <td className="num py-3 pr-4 text-ink">{p.elo.toLocaleString()}</td>
                  <td className="num hidden py-3 pr-4 text-ink-2 md:table-cell">{p.questions.toLocaleString()}</td>
                  <td className={`num py-3 pr-4 ${p.questions && p.accuracy < 65 ? 'font-semibold text-bad' : 'text-ink-2'}`}>{p.accuracy}%</td>
                  <td className="num hidden py-3 pr-4 text-ink-2 sm:table-cell">{att === null ? '0%' : `${att}%`}</td>
                  <td className={`hidden py-3 pr-4 md:table-cell ${p.lastActiveDays > 7 ? 'font-semibold text-bad' : 'text-ink-2'}`}>{p.lastActiveDays === 0 ? 'Today' : `${p.lastActiveDays} days ago`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const BUILDER_SIZE = 20

function Assignments({ meta, update, canEdit }: { meta: ChapterMeta; update: (fn: (m: ChapterMeta) => ChapterMeta) => void; canEdit: boolean }) {
  const { me } = useStore()
  const [title, setTitle] = useState('')
  const [type, setType] = useState<Assignment['type']>('Test')
  const [exam, setExam] = useState<ExamId>('bac')
  const [due, setDue] = useState('')
  const [builderExam, setBuilderExam] = useState<ExamId>('bac')
  const bank = useQuestions(builderExam)
  const [questions, setQuestions] = useState<Question[]>([])
  // A fresh 20-question draft from the bank whenever the exam changes.
  useEffect(() => { setQuestions(bank.questions ? sample(bank.questions, BUILDER_SIZE) : []) }, [bank.questions])
  const [editing, setEditing] = useState<string | null>(null)

  const add = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !due) return
    update((m) => ({ ...m, assignments: [...m.assignments, { id: Math.random().toString(36).slice(2), title: title.trim(), type, exam, due, by: me!.name }] }))
    setTitle('')
    setDue('')
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="space-y-8">
        <section>
          <SectionHeader title="Assigned work" />
          {meta.assignments.length === 0 ? (
            <div className="panel"><EmptyState icon={<ClipboardText size={22} />} title="Nothing assigned" body={canEdit ? 'Create a test or flashcard set for your members below.' : 'Your trainers have not assigned anything yet.'} /></div>
          ) : (
            <ul className="divide-y divide-line border border-line">
              {meta.assignments.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className="h-8 w-1.5 shrink-0" style={{ background: examOf(a.exam).color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
                    <p className="text-xs text-ink-3">{a.type}, {examOf(a.exam).name}, by {a.by}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs text-ink-2"><CalendarBlank size={14} /> {fmtDate(a.due)}</span>
                  {canEdit && <button className="link text-xs" onClick={() => update((m) => ({ ...m, assignments: m.assignments.filter((x) => x.id !== a.id) }))}>Remove</button>}
                </li>
              ))}
            </ul>
          )}
        </section>
        {canEdit && (
          <form className="panel space-y-4 p-6" onSubmit={add}>
            <h2 className="h-section">New assignment</h2>
            <div><label className="field-label" htmlFor="as-title">Title</label><input id="as-title" className="input" value={title} onChange={(e) => setTitle(e.target.value)} required /></div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="as-type">Type</label>
                <select id="as-type" className="input" value={type} onChange={(e) => setType(e.target.value as Assignment['type'])}><option>Test</option><option>Flashcards</option><option>Shuffled exam</option></select>
              </div>
              <div>
                <label className="field-label" htmlFor="as-exam">Exam</label>
                <select id="as-exam" className="input" value={exam} onChange={(e) => setExam(e.target.value as ExamId)}>{EXAMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
              </div>
              <div>
                <label className="field-label" htmlFor="as-due">Due</label>
                <input id="as-due" type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} required />
              </div>
            </div>
            <button className="btn-primary"><Plus size={16} /> Assign to chapter</button>
          </form>
        )}
      </div>

      <section>
        <SectionHeader
          title="Test builder"
          action={canEdit ? <button className="btn-secondary btn-sm" disabled={!bank.questions} onClick={() => bank.questions && setQuestions(sample(bank.questions, BUILDER_SIZE))}><Shuffle size={15} /> New draw</button> : undefined}
        />
        <label className="sr-only" htmlFor="tb-exam">Exam</label>
        <select id="tb-exam" className="input mb-4" value={builderExam} onChange={(e) => setBuilderExam(e.target.value as ExamId)}>
          {EXAMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
        {!bank.questions && <p className="text-sm text-ink-3">{bank.error ?? 'Loading questions…'}</p>}
        <ol className="divide-y divide-line border border-line empty:hidden">
          {questions.map((qq, i) => (
            <li key={qq.id} className="flex gap-3 px-5 py-4 text-sm">
              <span className="num pt-px font-semibold text-ink-3">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                {editing === qq.id ? (
                  <textarea aria-label="Question text" rows={3} className="input resize-none" value={qq.prompt} onChange={(e) => setQuestions(questions.map((x) => (x.id === qq.id ? { ...x, prompt: e.target.value } : x)))} />
                ) : (
                  <p className="text-ink">{qq.prompt}</p>
                )}
                <p className="mt-1.5 text-xs text-ink-3">Answer: {qq.choices[qq.answer]}</p>
              </div>
              {canEdit && (
                <button className="btn-ghost btn-sm h-7 w-7 shrink-0 px-0" onClick={() => setEditing(editing === qq.id ? null : qq.id)} aria-label={editing === qq.id ? 'Done editing' : 'Edit question'}>
                  {editing === qq.id ? <Check size={15} /> : <PencilSimple size={15} />}
                </button>
              )}
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
