import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import TopNav from './components/TopNav'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Play from './pages/Play'
import Vocab from './pages/Vocab'
import Arena from './pages/Arena'
import Chapter from './pages/Chapter'
import Me from './pages/Me'

export default function App() {
  const { pathname } = useLocation()
  return (
    <div className="flex min-h-[100dvh] flex-col">
      <TopNav />
      <main key={pathname} className="enter mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
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
      <footer className="border-t border-line bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-6 text-xs text-ink-3 sm:flex-row sm:justify-between sm:px-6">
          <span>DECA Masters</span>
          <span>A student-built practice tool. Not affiliated with DECA Inc.</span>
        </div>
      </footer>
    </div>
  )
}
