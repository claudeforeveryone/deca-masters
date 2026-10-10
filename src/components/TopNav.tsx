import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, List, X, SignOut, UserCircle } from '@phosphor-icons/react'
import { useMyEvent, useStore } from '../store'
import { Avatar } from './ui'
import Logo from './Logo'

const LINKS = [
  { to: '/', label: 'Home' },
  { to: '/leaderboard', label: 'Leaderboard' },
  { to: '/play', label: 'Play' },
  { to: '/vocab', label: 'Vocab' },
  { to: '/arena', label: 'Arena' },
  { to: '/chapter', label: 'Chapter' },
  { to: '/me', label: 'Me' },
]

type Note = { id: string; text: string; to?: string }

export default function TopNav() {
  const { signedIn, isGuest, me, myChapter, logout } = useStore()
  const { event } = useMyEvent()
  const [menu, setMenu] = useState(false)
  const [open, setOpen] = useState<'bell' | 'account' | null>(null)
  const [read, setRead] = useState<Set<string>>(new Set())
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const popRef = useRef<HTMLDivElement>(null)

  // Notifications come from your real state only.
  const notes = useMemo<Note[]>(() => {
    if (!me) return []
    const list: Note[] = [{ id: 'welcome', text: `You are practicing for ${event.name} (${event.code}).`, to: '/play' }]
    if (isGuest) list.unshift({ id: 'guest', text: 'You are using a guest session. Create an account to save progress and join the leaderboard.', to: '/register' })
    else if (!myChapter) list.unshift({ id: 'chapter', text: 'Join your chapter with its code, or create a new chapter.', to: '/chapter' })
    if (me.progress.streak > 1) list.unshift({ id: `streak${me.progress.streak}`, text: `You are on a ${me.progress.streak}-day practice streak.`, to: '/play' })
    return list
  }, [me, isGuest, myChapter, event])
  const unread = notes.filter((n) => !read.has(n.id)).length

  useEffect(() => {
    setMenu(false)
    setOpen(null)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !popRef.current?.contains(e.target as Node) && setOpen(null)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const signOut = () => {
    logout()
    navigate('/')
  }

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="container-page flex h-16 items-stretch gap-8">
        <Link to="/" className="flex shrink-0 items-center" aria-label="DECA Masters home">
          <Logo />
        </Link>

        {signedIn && (
          <nav className="hidden items-stretch gap-6 lg:flex">
            {LINKS.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `-mb-px flex items-center border-b-2 text-sm font-medium transition-colors ${isActive ? 'border-brand text-brand' : 'border-transparent text-ink hover:text-brand'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="ml-auto flex items-center gap-2" ref={popRef}>
          {!signedIn ? (
            <>
              <Link to="/login" className="btn-ghost btn-sm">Log in</Link>
              <Link to="/register" className="btn-primary btn-sm">Create account</Link>
            </>
          ) : (
            <>
              <span className="num mr-2 hidden text-[13px] font-semibold text-brand sm:inline">{me!.progress.elo.toLocaleString()} ELO</span>
              {isGuest && <Link to="/register" className="btn-primary btn-sm mr-1 hidden md:inline-flex">Create account</Link>}

              <div className="relative">
                <button
                  aria-label={`Notifications, ${unread} unread`}
                  onClick={() => setOpen(open === 'bell' ? null : 'bell')}
                  className="relative grid h-10 w-10 place-items-center rounded-soft text-ink hover:bg-canvas hover:text-brand"
                >
                  <Bell size={20} />
                  {unread > 0 && <span className="num absolute right-1 top-1.5 grid h-4 min-w-4 place-items-center rounded-soft bg-brand px-1 text-[10px] font-bold text-white">{unread}</span>}
                </button>
                {open === 'bell' && (
                  <div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-soft border border-line bg-white shadow-[0_12px_32px_rgba(20,20,20,.12)]">
                    <div className="flex items-center justify-between border-b border-line px-4 py-3">
                      <span className="text-sm font-semibold text-ink">Notifications</span>
                      {unread > 0 && (
                        <button className="text-xs font-semibold text-brand hover:underline" onClick={() => setRead(new Set(notes.map((n) => n.id)))}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    <ul className="max-h-[24rem] divide-y divide-line overflow-y-auto">
                      {notes.map((n) => {
                        const isNew = !read.has(n.id)
                        return (
                          <li key={n.id} className={`border-l-2 ${isNew ? 'border-brand bg-tint' : 'border-transparent'}`}>
                            <Link to={n.to ?? '/'} onClick={() => setRead(new Set(read).add(n.id))} className="block px-4 py-3 text-sm hover:bg-canvas">
                              <span className={isNew ? 'font-medium text-ink' : 'text-ink-2'}>{n.text}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </div>

              <div className="relative ml-1 hidden sm:block">
                <button onClick={() => setOpen(open === 'account' ? null : 'account')} aria-label="Account menu" className="flex items-center">
                  <Avatar name={isGuest ? 'G' : me!.name} size={34} />
                </button>
                {open === 'account' && (
                  <div className="absolute right-0 mt-3 w-60 overflow-hidden rounded-soft border border-line bg-white shadow-[0_12px_32px_rgba(20,20,20,.12)]">
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-sm font-semibold text-ink">{isGuest ? 'Guest' : me!.name}</p>
                      <p className="truncate text-xs text-ink-3">{event.code}, {event.name}</p>
                    </div>
                    <Link to="/me" className="flex items-center gap-2 px-4 py-2.5 text-sm text-ink-2 hover:bg-canvas"><UserCircle size={18} /> Profile</Link>
                    <button onClick={signOut} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink-2 hover:bg-canvas">
                      <SignOut size={18} /> {isGuest ? 'End guest session' : 'Log out'}
                    </button>
                  </div>
                )}
              </div>

              <button className="grid h-10 w-10 place-items-center rounded-soft text-ink lg:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
                {menu ? <X size={22} /> : <List size={22} />}
              </button>
            </>
          )}
        </div>
      </div>

      {signedIn && menu && (
        <nav className="border-t border-line bg-white lg:hidden">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) => `block border-b border-line px-4 py-4 text-sm font-medium ${isActive ? 'border-l-4 border-l-brand text-brand' : 'text-ink'}`}
            >
              {label}
            </NavLink>
          ))}
          {isGuest && <Link to="/register" className="block border-b border-line px-4 py-4 text-sm font-semibold text-brand">Create account</Link>}
          <button onClick={signOut} className="block w-full px-4 py-4 text-left text-sm font-medium text-ink">{isGuest ? 'End guest session' : 'Log out'}</button>
        </nav>
      )}
    </header>
  )
}
