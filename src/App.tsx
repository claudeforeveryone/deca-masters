import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import TopNav from './components/TopNav'
import Logo from './components/Logo'
import { useStore } from './store'
import Welcome from './pages/Welcome'
import Register from './pages/Register'
import Login from './pages/Login'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Play from './pages/Play'
import Vocab from './pages/Vocab'
import Bank from './pages/Bank'
import Arena from './pages/Arena'
import Chapter from './pages/Chapter'
import Me from './pages/Me'
import Settings from './pages/Settings'

const FOOTER = [
  { title: 'Practice', links: [['Play', '/play'], ['Questions', '/bank'], ['Vocab', '/vocab'], ['Arena', '/arena']] },
  { title: 'Compete', links: [['Leaderboard', '/leaderboard'], ['Chapter', '/chapter']] },
  { title: 'Account', links: [['Profile', '/me'], ['Settings', '/settings'], ['Create account', '/register']] },
]

export default function App() {
  const { pathname } = useLocation()
  const { signedIn } = useStore()

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main key={pathname} className="enter container-page flex-1 pb-20">
        {signedIn ? (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/play" element={<Play />} />
            <Route path="/vocab" element={<Vocab />} />
            <Route path="/bank" element={<Bank />} />
            <Route path="/arena" element={<Arena />} />
            <Route path="/chapter" element={<Chapter />} />
            <Route path="/me" element={<Me />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        ) : (
          <Routes>
            <Route path="/" element={<Welcome />} />
            <Route path="/register" element={<Register />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        )}
      </main>
      <footer className="bg-navy-footer text-[#8F8F8F]">
        <div className="container-page flex flex-col gap-7 py-8 md:flex-row md:items-start md:justify-between">
          <div>
            <Logo inverse />
            <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed">
              Practice cluster exams, climb the leaderboard and train with your chapter.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-6 sm:gap-14">
            {FOOTER.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-bold uppercase tracking-label text-white">{col.title}</p>
                <ul className="mt-3 space-y-2 text-[13px]">
                  {col.links.map(([label, to]) => (
                    <li key={label}><Link to={to} className="hover:text-white">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="container-page flex flex-col gap-1 py-5 text-xs sm:flex-row sm:justify-between sm:gap-6">
            <p>A student-built practice tool. Not affiliated with or endorsed by DECA Inc.</p>
            <p>Progress and settings are saved in this browser.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
