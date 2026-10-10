import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import TopNav from './components/TopNav'
import Logo from './components/Logo'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Play from './pages/Play'
import Vocab from './pages/Vocab'
import Arena from './pages/Arena'
import Chapter from './pages/Chapter'
import Me from './pages/Me'

const FOOTER = [
  { title: 'Practice', links: [['Play', '/play'], ['Vocab', '/vocab'], ['Arena', '/arena']] },
  { title: 'Compete', links: [['Leaderboard', '/leaderboard'], ['Chapter', '/chapter']] },
  { title: 'Account', links: [['Profile', '/me'], ['Career', '/me']] },
]

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main key={pathname} className="enter container-page flex-1 pb-20">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/play" element={<Play />} />
          <Route path="/vocab" element={<Vocab />} />
          <Route path="/arena" element={<Arena />} />
          <Route path="/chapter" element={<Chapter />} />
          <Route path="/me" element={<Me />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </main>
      <footer className="bg-navy-footer text-[#8F8F8F]">
        <div className="container-page grid gap-10 py-14 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Logo inverse />
            <p className="mt-5 max-w-[34ch] text-[13px] leading-relaxed">
              Practice cluster exams, climb the leaderboard and train with your chapter.
            </p>
          </div>
          {FOOTER.map((col) => (
            <div key={col.title}>
              <p className="text-[11px] font-bold uppercase tracking-label text-white">{col.title}</p>
              <ul className="mt-4 space-y-3 text-[13px]">
                {col.links.map(([label, to]) => (
                  <li key={label}><Link to={to} className="hover:text-white">{label}</Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-white/10">
          <p className="container-page py-5 text-xs">A student-built practice tool. Not affiliated with or endorsed by DECA Inc.</p>
        </div>
      </footer>
    </div>
  )
}
