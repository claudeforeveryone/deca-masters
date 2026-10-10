import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Bell, List, X } from '@phosphor-icons/react'
import { ME, NOTIFICATIONS } from '../data/mock'
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

export default function TopNav() {
  const [menu, setMenu] = useState(false)
  const [bell, setBell] = useState(false)
  const [notes, setNotes] = useState(NOTIFICATIONS)
  const unread = notes.filter((n) => n.unread).length
  const { pathname } = useLocation()
  const bellRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMenu(false)
    setBell(false)
  }, [pathname])

  useEffect(() => {
    if (!bell) return
    const close = (e: MouseEvent) => !bellRef.current?.contains(e.target as Node) && setBell(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [bell])

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white">
      <div className="container-page flex h-16 items-stretch gap-8">
        <Link to="/" className="flex shrink-0 items-center" aria-label="DECA Masters home">
          <Logo />
        </Link>

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

        <div className="ml-auto flex items-center gap-2">
          <span className="num mr-2 hidden text-[13px] font-semibold text-brand sm:inline">{ME.elo.toLocaleString()} ELO</span>

          <div className="relative" ref={bellRef}>
            <button aria-label={`Notifications, ${unread} unread`} onClick={() => setBell((b) => !b)} className="relative grid h-10 w-10 place-items-center text-ink hover:text-brand">
              <Bell size={20} />
              {unread > 0 && (
                <span className="num absolute right-1 top-1.5 grid h-4 min-w-4 place-items-center bg-brand px-1 text-[10px] font-bold text-white">{unread}</span>
              )}
            </button>
            {bell && (
              <div className="absolute right-0 mt-3 w-[min(24rem,calc(100vw-2rem))] border border-line bg-white shadow-[0_12px_32px_rgba(20,20,20,.12)]">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <span className="text-sm font-semibold text-ink">Notifications</span>
                  {unread > 0 && (
                    <button className="text-xs font-semibold text-brand hover:underline" onClick={() => setNotes(notes.map((n) => ({ ...n, unread: false })))}>
                      Mark all read
                    </button>
                  )}
                </div>
                <ul className="max-h-[24rem] divide-y divide-line overflow-y-auto">
                  {notes.map((n) => (
                    <li key={n.id} className={`flex gap-3 px-4 py-3 ${n.unread ? 'border-l-2 border-brand bg-tint' : 'border-l-2 border-transparent'}`}>
                      <div className="min-w-0 text-sm">
                        <p className={n.unread ? 'font-medium text-ink' : 'text-ink-2'}>{n.text}</p>
                        <p className="mt-0.5 text-xs text-ink-3">{n.time}</p>
                        {n.kind === 'arena' && (
                          <div className="mt-2.5 flex gap-2">
                            <Link to="/arena" className="btn-primary btn-sm">Accept</Link>
                            <button className="btn-secondary btn-sm" onClick={() => setNotes(notes.filter((x) => x.id !== n.id))}>Decline</button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Link to="/me" className="ml-1 hidden sm:block" aria-label="Your profile">
            <Avatar name={ME.name} size={34} />
          </Link>

          <button className="grid h-10 w-10 place-items-center text-ink lg:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
            {menu ? <X size={22} /> : <List size={22} />}
          </button>
        </div>
      </div>

      {menu && (
        <nav className="border-t border-line bg-white lg:hidden">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `block border-b border-line px-4 py-4 text-sm font-medium ${isActive ? 'border-l-4 border-l-brand text-brand' : 'text-ink'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
