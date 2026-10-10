import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { PageBand } from '../components/ui'

export default function Login() {
  const { login } = useStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    const err = await login(email, password)
    setBusy(false)
    if (err) setError(err)
    else navigate('/')
  }

  return (
    <div>
      <PageBand tag="Welcome back" title="Log in" />
      <form onSubmit={submit} className="max-w-md space-y-5">
        <div>
          <label className="field-label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="field-label" htmlFor="password">Password</label>
          <input id="password" type="password" className="input" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <p role="alert" className="border-l-4 border-bad bg-bad-bg px-4 py-3 text-sm font-medium text-bad">{error}</p>}
        <div className="flex flex-wrap items-center gap-4">
          <button className="btn-primary btn-lg" disabled={busy}>{busy ? 'Logging in' : 'Log in'}</button>
          <span className="text-sm text-ink-3">New here? <Link to="/register" className="link">Create an account</Link></span>
        </div>
      </form>
    </div>
  )
}
