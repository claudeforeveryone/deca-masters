import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { Bell, Menu, X, Swords, Home, Trophy, Play, BookOpen, Users, User } from 'lucide-react'
import { ME, NOTIFICATIONS } from '../data/mock'
import Logo from './Logo'

const LINKS = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/play', label: 'Play', icon: Play },
  { to: '/vocab', label: 'Vocab', icon: BookOpen },
  { to: '/arena', label: 'Arena', icon: Swords },
  { to: '/chapter', label: 'Chapter', icon: Users },
  { to: '/me', label: 'Me', icon: User },
]

export default function TopNav() {
  const [open, setOpen] = useState(false)
  const [bell, setBell] = useState(false)
  const [notes, setNotes] = useState(NOTIFICATIONS)
  const unread = notes.filter((n) => n.unread).length

  return (
    <header className="sticky top-0 z-40 bg-navy text-white shadow-lg">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <Logo className="h-9 w-9" />
          <span className="text-lg font-extrabold tracking-tight">
            DECA <span className="text-deca-light">Masters</span>
          </span>
        </Link>

        <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
          {LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-semibold transition ${
                  isActive ? 'bg-deca text-white' : 'text-sky-200 hover:bg-navy-700 hover:text-white'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden rounded-full bg-navy-700 px-3 py-1 text-xs font-bold sm:inline">
            {ME.elo} ELO
          </span>

          <div className="relative">
            <button
              aria-label="Notifications"
              onClick={() => setBell((b) => !b)}
              className="relative rounded-lg p-2 hover:bg-navy-700"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-deca-light text-[10px] font-bold text-navy">
                  {unread}
                </span>
              )}
            </button>
            {bell && (
              <div className="absolute right-0 mt-2 w-80 overflow-hidden rounded-2xl bg-white text-navy shadow-xl ring-1 ring-sky-100">
                <div className="flex items-center justify-between border-b border-sky-100 px-4 py-3">
                  <span className="font-bold">Notifications</span>
                  <button
                    className="text-xs font-semibold text-deca"
                    onClick={() => setNotes(notes.map((n) => ({ ...n, unread: false })))}
                  >
                    Mark all read
                  </button>
                </div>
                <ul className="max-h-96 overflow-y-auto">
                  {notes.map((n) => (
                    <li key={n.id} className={`flex gap-3 px-4 py-3 text-sm ${n.unread ? 'bg-sky-50' : ''}`}>
                      <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.unread ? 'bg-deca' : 'bg-transparent'}`} />
                      <div>
                        <p>{n.text}</p>
                        <p className="mt-0.5 text-xs text-navy/50">{n.time}</p>
                        {n.kind === 'arena' && (
                          <div className="mt-2 flex gap-2">
                            <Link to="/arena" onClick={() => setBell(false)} className="btn-primary px-3 py-1 text-xs">Accept</Link>
                            <button className="btn-ghost px-3 py-1 text-xs">Decline</button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <Link to="/me" className="hidden sm:block">
            <img src={ME.avatar} alt="" className="h-9 w-9 rounded-full ring-2 ring-deca-light" />
          </Link>

          <button className="rounded-lg p-2 hover:bg-navy-700 lg:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <nav className="grid grid-cols-2 gap-1 border-t border-navy-700 px-4 py-3 lg:hidden">
          {LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold ${isActive ? 'bg-deca' : 'text-sky-200'}`
              }
            >
              <Icon className="h-4 w-4" /> {label}
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  )
}
