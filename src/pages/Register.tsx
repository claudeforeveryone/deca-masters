import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { clusterOf, eventByCode, examOf } from '../data/events'
import { useStore } from '../store'
import { EventPicker, PageBand } from '../components/ui'

export default function Register() {
  const { register, isGuest, me, signedIn } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ name: '', email: '', password: '', school: '', grade: 0, chapterCode: params.get('chapter') ?? '' })
  const [eventCode, setEventCode] = useState(isGuest ? me!.eventCode : '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const ev = eventByCode(eventCode)

  if (signedIn && !isGuest) {
    return (
      <div>
        <PageBand title="You are signed in" description="You already have an account on this device." />
        <Link to="/" className="btn-primary">Go home</Link>
      </div>
    )
  }

  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: k === 'grade' ? Number(e.target.value) : e.target.value })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.grade) return setError('Pick your grade.')
    setBusy(true)
    const err = await register({ ...form, eventCode })
    setBusy(false)
    if (err) setError(err)
    else navigate('/')
  }

  return (
    <div>
      <PageBand
        tag="Join DECA Masters"
        title="Create your account"
        description={isGuest ? 'Your guest practice so far will be saved to your new account.' : 'Tell us who you are and which event you compete in.'}
      />

      <form onSubmit={submit} className="grid gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-5">
          <div>
            <label className="field-label" htmlFor="name">Full name</label>
            <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} required />
          </div>
          <div>
            <label className="field-label" htmlFor="email">Email</label>
            <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required />
          </div>
          <div>
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" type="password" className="input" autoComplete="new-password" minLength={6} value={form.password} onChange={set('password')} required />
            <p className="mt-1.5 text-xs text-ink-3">At least 6 characters.</p>
          </div>
          <div>
            <label className="field-label" htmlFor="school">School</label>
            <input id="school" className="input" placeholder="Type your school name" value={form.school} onChange={set('school')} required />
          </div>
          <div>
            <label className="field-label" htmlFor="grade">Grade</label>
            <select id="grade" className="input" value={form.grade} onChange={set('grade')} required>
              <option value={0} disabled>Select your grade</option>
              {[9, 10, 11, 12].map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="chapter">Chapter code <span className="font-normal text-ink-3">(optional)</span></label>
            <input id="chapter" className="input uppercase" placeholder="LINC-7Q4K" value={form.chapterCode} onChange={set('chapterCode')} />
            <p className="mt-1.5 text-xs text-ink-3">Ask your chapter president for the code. You can also join or create a chapter later.</p>
          </div>
        </div>

        <div>
          <p className="field-label">Your event</p>
          <EventPicker value={eventCode} onChange={setEventCode} />
          {ev && (
            <p className="mt-3 border-l-4 border-brand bg-tint px-4 py-3 text-sm text-ink-2">
              <span className="font-semibold text-ink">{ev.name}</span> is in the {clusterOf(ev.cluster).name} cluster and uses the <span className="font-semibold text-ink">{examOf(ev.exam).name}</span> exam.
            </p>
          )}

          {error && <p role="alert" className="mt-5 border-l-4 border-bad bg-bad-bg px-4 py-3 text-sm font-medium text-bad">{error}</p>}
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <button className="btn-primary btn-lg" disabled={busy || !ev}>{busy ? 'Creating account' : 'Create account'}</button>
            <span className="text-sm text-ink-3">Already have one? <Link to="/login" className="link">Log in</Link></span>
          </div>
          <p className="mt-6 text-xs text-ink-3">Accounts are stored in this browser for now. Online accounts are coming with the full release.</p>
        </div>
      </form>
    </div>
  )
}
