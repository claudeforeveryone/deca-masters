import { Navigate, Route, Routes } from 'react-router-dom'
import TopNav from './components/TopNav'
import Home from './pages/Home'
import Leaderboard from './pages/Leaderboard'
import Play from './pages/Play'
import Vocab from './pages/Vocab'
import Arena from './pages/Arena'
import Chapter from './pages/Chapter'
import Me from './pages/Me'

export default function App() {
  return (
    <div className="min-h-screen">
      <TopNav />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
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
      <footer className="border-t border-sky-100 bg-white py-6 text-center text-xs text-navy/50">
        DECA Masters is a student-built practice tool and is not affiliated with DECA Inc.
      </footer>
    </div>
  )
}
