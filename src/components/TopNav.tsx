import { useEffect, useRef, useState } from 'react'
import { NavLink, Link, useLocation } from 'react-router-dom'
import { Bell, List, X, Sword, Users, Trophy, BookOpenText, Lightning, House, UserCircle } from '@phosphor-icons/react'
import { ME, NOTIFICATIONS } from '../data/mock'
import { Avatar } from './ui'
import Logo from './Logo'

const LINKS = [
  { to: '/', label: 'Home', icon: House },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/play', label: 'Play', icon: Lightning },
  { to: '/vocab', label: 'Vocab', icon: BookOpenText },
  { to: '/arena', label: 'Arena', icon: Sword },
  { to: '/chapter', label: 'Chapter', icon: Users },
  { to: '/me', label: 'Me', icon: UserCircle },
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
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <Logo />
          <span className="text-[15px] font-semibold tracking-tight">DECA Masters</span>
        </Link>

        <nav className="hidden items-center gap-0.5 lg:flex">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-tint text-brand' : 'text-ink-3 hover:text-ink'}`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <span className="num mr-1 hidden rounded-md border border-line px-2 py-1 text-[13px] text-ink-2 sm:inline">
            {ME.elo.toLocaleString()} <span className="font-sans text-ink-3">ELO</span>
          </span>

          <div className="relative" ref={bellRef}>
            <button aria-label={`Notifications, ${unread} unread`} onClick={() => setBell((b) => !b)} className="btn-ghost relative w-9 px-0">
              <Bell size={19} />
              {unread > 0 && (
                <span className="num absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                  {unread}
                </span>
              )}
            </button>
            {bell && (
              <div className="absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-line bg-white shadow-pop">
                <div className="flex items-center justify-between border-b border-line px-4 py-3">
                  <span className="text-sm font-semibold">Notifications</span>
                  {unread > 0 && (
                    <button className="text-[13px] font-medium text-brand hover:underline" onClick={() => setNotes(notes.map((n) => ({ ...n, unread: false })))}>
                      Mark all read
                    </button>
                  )}
                </div>
                <ul className="max-h-[22rem] overflow-y-auto py-1">
                  {notes.map((n) => (
                    <li key={n.id} className="flex gap-3 px-4 py-3 hover:bg-canvas">
                      <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${n.unread ? 'bg-brand' : 'bg-transparent'}`} aria-hidden />
                      <div className="min-w-0 text-sm">
                        <p className={n.unread ? 'text-ink' : 'text-ink-2'}>{n.text}</p>
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
            <Avatar name={ME.name} size={32} />
          </Link>

          <button className="btn-ghost w-9 px-0 lg:hidden" onClick={() => setMenu((m) => !m)} aria-label="Menu" aria-expanded={menu}>
            {menu ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {menu && (
        <nav className="border-t border-line bg-white px-4 py-2 lg:hidden">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-tint text-brand' : 'text-ink-2'}`
              }
            >
              <Icon size={18} /> {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
