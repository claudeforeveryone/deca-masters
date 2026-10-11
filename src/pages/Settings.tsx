import { useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle, SpeakerHigh, SpeakerSlash, UserCircle } from '@phosphor-icons/react'
import { clusterOf, examOf } from '../data/events'
import { useMyEvent, useStore } from '../store'
import { DEFAULT_PREFS, TEXT_SIZES, THEMES, resetPrefs, usePrefs, type Theme } from '../prefs'
import { canVibrate, previewSound } from '../sound'
import { EmptyState, EventPicker, PageBand, Toggle } from '../components/ui'

const TABS = [
  { id: 'appearance', label: 'Appearance' },
  { id: 'sound', label: 'Sound' },
  { id: 'account', label: 'Account' },
  { id: 'events', label: 'Events' },
] as const
type Tab = (typeof TABS)[number]['id']

export default function Settings() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = TABS.find((t) => t.id === params.get('tab'))?.id ?? 'appearance'

  return (
    <div>
      <PageBand tag="Settings" title="Settings" description="Appearance and sound are saved on this device. Account and event changes follow you." />
      <div className="grid gap-8 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-14">
        {/* Phones: one row of tabs that scrolls sideways. Desktop: a rail on the left. */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-24 lg:self-start">
          <ul className="no-scrollbar flex overflow-x-auto border border-line lg:flex-col">
            {TABS.map((t) => {
              const on = t.id === tab
              return (
                <li key={t.id} className="shrink-0 border-r border-line last:border-r-0 lg:border-b lg:border-r-0 lg:last:border-b-0">
                  <button
                    onClick={() => setParams({ tab: t.id }, { replace: true })}
                    aria-current={on ? 'page' : undefined}
                    className={`flex h-12 w-full items-center whitespace-nowrap border-l-4 px-4 text-sm font-semibold transition-colors ${on ? 'border-brand bg-tint text-brand' : 'border-transparent text-ink-2 hover:bg-canvas hover:text-ink'}`}
                  >
                    {t.label}
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
        <div key={tab} className="enter min-w-0">
          {tab === 'appearance' && <Appearance />}
          {tab === 'sound' && <Sound />}
          {tab === 'account' && <Account />}
          {tab === 'events' && <Events />}
        </div>
      </div>
    </div>
  )
}

/** One setting: its name and a line on what it does, then the control. */
function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="grid gap-4 border-b border-line py-8 first:pt-0 last:border-b-0 md:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] md:gap-10">
      <div>
        <h2 className="h-section">{title}</h2>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Saved({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-good">
      <CheckCircle size={16} weight="fill" /> {children}
    </p>
  )
}

function Problem({ children }: { children: ReactNode }) {
  return <p role="alert" className="mt-3 border-l-4 border-bad bg-bad-bg px-4 py-3 text-sm font-medium text-bad">{children}</p>
}

// Small drawings of a page in each mode, so the choice reads at a glance.
const PREVIEW: Record<Theme, ReactNode> = {
  light: <Sketch bg="#FFFFFF" bar="#0072CE" line="#E4E4E4" />,
  dark: <Sketch bg="#0F141B" bar="#1F86DA" line="#2D3745" />,
  system: (
    <span className="grid h-full grid-cols-2">
      <Sketch bg="#FFFFFF" bar="#0072CE" line="#E4E4E4" />
      <Sketch bg="#0F141B" bar="#1F86DA" line="#2D3745" />
    </span>
  ),
}
function Sketch({ bg, bar, line }: { bg: string; bar: string; line: string }) {
  return (
    <span className="flex h-full flex-col gap-1.5 p-2.5" style={{ background: bg }} aria-hidden>
      <span className="h-3 w-full" style={{ background: bar }} />
      <span className="h-1.5 w-3/4" style={{ background: line }} />
      <span className="h-1.5 w-1/2" style={{ background: line }} />
    </span>
  )
}

function Appearance() {
  const [prefs, save] = usePrefs()
  const deviceReduces = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const [reset, setReset] = useState(false)
  return (
    <div>
      <Row title="Mode" description="Light, dark, or whatever your device is set to.">
        <div role="radiogroup" aria-label="Mode" className="grid max-w-lg grid-cols-3 gap-3">
          {THEMES.map((t) => {
            const on = prefs.theme === t.id
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={on}
                onClick={() => save({ theme: t.id })}
                className={`overflow-hidden rounded-box border-2 text-left transition-colors ${on ? 'border-brand' : 'border-line hover:border-line-strong'}`}
              >
                <span className="block h-16 border-b border-line">{PREVIEW[t.id]}</span>
                <span className={`flex items-center justify-between px-3 py-2 text-sm font-semibold ${on ? 'text-brand' : 'text-ink'}`}>
                  {t.label}
                  {on && <CheckCircle size={16} weight="fill" />}
                </span>
              </button>
            )
          })}
        </div>
      </Row>

      <Row title="Text size" description="Makes everything on the page bigger, text and buttons alike.">
        <div role="radiogroup" aria-label="Text size" className="inline-flex rounded-soft border border-line-strong p-1">
          {TEXT_SIZES.map((t, k) => {
            const on = prefs.text === t.id
            return (
              <button
                key={t.id}
                role="radio"
                aria-checked={on}
                onClick={() => save({ text: t.id })}
                className={`flex h-10 items-center gap-2 rounded-soft px-3 text-sm font-semibold transition-colors sm:px-4 ${on ? 'bg-brand text-white' : 'text-ink-2 hover:bg-canvas'}`}
              >
                <span style={{ fontSize: 13 + k * 3 }} aria-hidden>Aa</span>
                {t.label}
              </button>
            )
          })}
        </div>
      </Row>

      <Row
        title="Reduce motion"
        description={deviceReduces ? 'Your device already asks for less motion, so animations are off.' : 'Stops page animations and the moving cluster strip, which becomes a still grid.'}
      >
        <label className="flex items-center gap-3 text-sm text-ink-2">
          <Toggle label="Reduce motion" on={deviceReduces || prefs.motion === 'reduce'} disabled={deviceReduces} onChange={(v) => save({ motion: v ? 'reduce' : 'system' })} />
          {deviceReduces || prefs.motion === 'reduce' ? 'On' : 'Off'}
        </label>
      </Row>

      <Row title="Reset" description="Puts appearance and sound back to the defaults on this device. Your account is not changed.">
        <button className="btn-secondary" onClick={() => { resetPrefs(); setReset(true) }}>Reset to defaults</button>
        {reset && <Saved>Back to the defaults.</Saved>}
      </Row>
    </div>
  )
}

function Sound() {
  const [prefs, save] = usePrefs()
  const vibrate = canVibrate()
  return (
    <div>
      <Row title="Sound effects" description="A chime for right answers that climbs with your streak, a soft bonk for misses, and a fanfare when you finish or gain ELO.">
        <label className="flex items-center gap-3 text-sm text-ink-2">
          <Toggle label="Sound effects" on={prefs.sound} onChange={(v) => save({ sound: v })} />
          {prefs.sound ? 'On' : 'Off'}
        </label>
      </Row>

      <Row title="Volume" description={`How loud the effects play. The default is ${DEFAULT_PREFS.volume}%.`}>
        <div className={`flex max-w-md items-center gap-4 ${prefs.sound ? '' : 'opacity-40'}`}>
          {prefs.volume === 0 ? <SpeakerSlash size={20} className="shrink-0 text-ink-3" /> : <SpeakerHigh size={20} className="shrink-0 text-ink-3" />}
          <input
            type="range"
            min={0}
            max={100}
            step={10}
            value={prefs.volume}
            disabled={!prefs.sound}
            onChange={(e) => save({ volume: Number(e.target.value) })}
            aria-label="Volume"
            className="h-2 flex-1 cursor-pointer accent-brand disabled:cursor-not-allowed"
          />
          <span className="num w-11 text-right text-sm font-semibold text-ink">{prefs.volume}%</span>
        </div>
        <button className="btn-secondary btn-sm mt-5" disabled={!prefs.sound || prefs.volume === 0} onClick={() => previewSound(prefs.volume)}>
          Play a sample
        </button>
      </Row>

      {vibrate && (
        <Row title="Vibration" description="A short buzz with each answer on phones that can vibrate.">
          <label className="flex items-center gap-3 text-sm text-ink-2">
            <Toggle label="Vibration" on={prefs.haptics} onChange={(v) => save({ haptics: v })} />
            {prefs.haptics ? 'On' : 'Off'}
          </label>
        </Row>
      )}
    </div>
  )
}

function Account() {
  const { isGuest, me, logout, resetProgress } = useStore()
  const navigate = useNavigate()
  const signOut = () => {
    logout()
    navigate('/')
  }

  if (isGuest)
    return (
      <div>
        <div className="panel mb-8">
          <EmptyState
            icon={<UserCircle size={22} />}
            title="You are using a guest session"
            body="Create an account to keep your ELO and history, join your chapter and appear on the leaderboard. Your guest practice carries over."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Link to="/register" className="btn-primary">Create account</Link>
                <Link to="/login" className="btn-secondary">Log in</Link>
              </div>
            }
          />
        </div>
        <Row title="Reset progress" description="Clears the ELO, sessions and stats from this guest session.">
          <Confirm label="Reset guest progress" question={`Clear ${me!.progress.history.length} sessions and ${me!.progress.elo} ELO?`} onConfirm={resetProgress} done="Guest progress cleared." />
        </Row>
        <Row title="End guest session" description="Leaves the guest session on this device. Its progress stays here until you start again.">
          <button className="btn-secondary" onClick={signOut}>End guest session</button>
        </Row>
      </div>
    )

  return (
    <div>
      <Profile />
      <Password />
      <Row title="Log out" description="Signs you out on this device.">
        <button className="btn-secondary" onClick={signOut}>Log out</button>
      </Row>
      <Row title="Reset progress" description="Clears your ELO, sessions, streaks and stats. Your account, chapter and event stay.">
        <Confirm label="Reset progress" question={`Clear ${me!.progress.history.length} sessions and ${me!.progress.elo} ELO? This can't be undone.`} onConfirm={resetProgress} done="Your progress was reset." />
      </Row>
      <DeleteAccount />
    </div>
  )
}

/** A destructive button that asks once more before it acts. */
function Confirm({ label, question, onConfirm, done }: { label: string; question: string; onConfirm: () => void; done: string }) {
  const [asking, setAsking] = useState(false)
  const [finished, setFinished] = useState(false)
  if (finished) return <Saved>{done}</Saved>
  if (!asking) return <button className="btn-secondary border-bad text-bad hover:bg-bad hover:text-white" onClick={() => setAsking(true)}>{label}</button>
  return (
    <div className="max-w-md border-l-4 border-bad bg-bad-bg px-4 py-4">
      <p className="text-sm font-medium text-ink">{question}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button className="btn btn-sm border-bad bg-bad text-white hover:opacity-90" onClick={() => { onConfirm(); setFinished(true) }}>Yes, {label.toLowerCase()}</button>
        <button className="btn-ghost btn-sm" onClick={() => setAsking(false)}>Cancel</button>
      </div>
    </div>
  )
}

function Profile() {
  const { me, updateProfile } = useStore()
  const [form, setForm] = useState({ name: me!.name, school: me!.school, grade: me!.grade })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const changed = form.name !== me!.name || form.school !== me!.school || form.grade !== me!.grade
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const err = updateProfile(form)
    setMsg(err ? { ok: false, text: err } : { ok: true, text: 'Profile saved.' })
  }
  return (
    <Row title="Profile" description={<>Shown on the leaderboard and to your chapter. Signed in as <span className="font-semibold text-ink-2">{me!.email}</span>.</>}>
      <form onSubmit={submit} className="grid max-w-lg gap-5">
        <div>
          <label className="field-label" htmlFor="set-name">Full name</label>
          <input id="set-name" className="input" autoComplete="name" value={form.name} onChange={(e) => { setForm({ ...form, name: e.target.value }); setMsg(null) }} required />
        </div>
        <div className="grid gap-5 sm:grid-cols-[1fr_10rem]">
          <div>
            <label className="field-label" htmlFor="set-school">School</label>
            <input id="set-school" className="input" value={form.school} onChange={(e) => { setForm({ ...form, school: e.target.value }); setMsg(null) }} required />
          </div>
          <div>
            <label className="field-label" htmlFor="set-grade">Grade</label>
            <select id="set-grade" className="input" value={form.grade} onChange={(e) => { setForm({ ...form, grade: Number(e.target.value) }); setMsg(null) }}>
              {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
        </div>
        <div>
          <button className="btn-primary" disabled={!changed}>Save profile</button>
          {msg && (msg.ok ? <Saved>{msg.text}</Saved> : <Problem>{msg.text}</Problem>)}
        </div>
      </form>
    </Row>
  )
}

function Password() {
  const { changePassword } = useStore()
  const [form, setForm] = useState({ current: '', next: '', again: '' })
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => { setForm({ ...form, [k]: e.target.value }); setMsg(null) }
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (form.next !== form.again) return setMsg({ ok: false, text: 'The new passwords do not match.' })
    setBusy(true)
    const err = await changePassword(form.current, form.next)
    setBusy(false)
    if (err) return setMsg({ ok: false, text: err })
    setForm({ current: '', next: '', again: '' })
    setMsg({ ok: true, text: 'Password changed.' })
  }
  return (
    <Row title="Password" description="Accounts live in this browser, so this changes the password for this device.">
      <form onSubmit={submit} className="grid max-w-lg gap-5">
        <div>
          <label className="field-label" htmlFor="pw-current">Current password</label>
          <input id="pw-current" type="password" className="input" autoComplete="current-password" value={form.current} onChange={set('current')} required />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="pw-next">New password</label>
            <input id="pw-next" type="password" className="input" autoComplete="new-password" minLength={6} value={form.next} onChange={set('next')} required />
          </div>
          <div>
            <label className="field-label" htmlFor="pw-again">Repeat new password</label>
            <input id="pw-again" type="password" className="input" autoComplete="new-password" minLength={6} value={form.again} onChange={set('again')} required />
          </div>
        </div>
        <div>
          <button className="btn-primary" disabled={busy}>{busy ? 'Changing password' : 'Change password'}</button>
          {msg && (msg.ok ? <Saved>{msg.text}</Saved> : <Problem>{msg.text}</Problem>)}
        </div>
      </form>
    </Row>
  )
}

function DeleteAccount() {
  const { deleteAccount } = useStore()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const err = await deleteAccount(password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/')
  }
  return (
    <Row title="Delete account" description="Removes your account and all of its progress from this browser. This can't be undone.">
      {!open ? (
        <button className="btn-secondary border-bad text-bad hover:bg-bad hover:text-white" onClick={() => setOpen(true)}>Delete account</button>
      ) : (
        <form onSubmit={submit} className="max-w-md border-l-4 border-bad bg-bad-bg px-4 py-4">
          <label className="field-label" htmlFor="del-pw">Enter your password to confirm</label>
          <input id="del-pw" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setError('') }} required />
          {error && <p role="alert" className="mt-2 text-sm font-medium text-bad">{error}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn btn-sm border-bad bg-bad text-white hover:opacity-90" disabled={busy}>Delete my account</button>
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setOpen(false); setPassword(''); setError('') }}>Cancel</button>
          </div>
        </form>
      )}
    </Row>
  )
}

function Events() {
  const { isGuest, myChapter, setEvent } = useStore()
  const { event, cluster, exam } = useMyEvent()
  const [changed, setChanged] = useState(false)
  const myExam = examOf(exam)
  return (
    <div>
      <Row title="Your event" description="Home, Play, Vocab and the Arena are built around the exam your event uses.">
        <div className="flex items-stretch overflow-hidden rounded-box border border-line">
          <span className="w-2 shrink-0" style={{ background: clusterOf(cluster.id).color }} aria-hidden />
          <div className="min-w-0 flex-1 px-5 py-4">
            <p className="text-[11px] font-bold uppercase tracking-label text-brand">{event.code}, {event.type}</p>
            <p className="mt-1 text-lg font-semibold tracking-head text-ink">{event.name}</p>
            <p className="mt-1 text-sm text-ink-3">{cluster.name} cluster, {myExam.name} exam</p>
          </div>
        </div>
        {changed && <Saved>Saved. Your practice now uses the {myExam.name} exam.</Saved>}
      </Row>
      <section className="border-b border-line py-8">
        <h2 className="h-section">Change event</h2>
        <p className="mt-1.5 text-sm text-ink-3">Search by name or code, or browse by career cluster.</p>
        <div className="mt-5">
          <EventPicker wide value={event.code} onChange={(c) => { setEvent(c); setChanged(true) }} />
        </div>
      </section>
      <Row title="Chapter" description={isGuest ? 'Chapters need an account.' : myChapter ? `You are in ${myChapter.name}.` : 'Join with the code from your chapter president, or start one for your school.'}>
        {isGuest ? (
          <Link to="/register" className="btn-primary">Create account</Link>
        ) : (
          <Link to="/chapter" className="btn-secondary">{myChapter ? 'Open your chapter' : 'Join or create a chapter'}</Link>
        )}
      </Row>
    </div>
  )
}
