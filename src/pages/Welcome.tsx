import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle } from '@phosphor-icons/react'
import { eventByCode, examOf } from '../data/events'
import { useStore } from '../store'
import { ClusterMarquee, EventPicker } from '../components/ui'

export default function Welcome() {
  const { startGuest } = useStore()
  const [code, setCode] = useState('')
  const ev = eventByCode(code)

  return (
    <div>
      <section className="bleed diamond-pattern bg-brand text-white">
        <div className="container-page py-16 sm:py-24">
          <h1 className="display max-w-4xl text-[40px] sm:text-6xl">Practice for your DECA event.</h1>
          <p className="mt-5 max-w-[52ch] text-base leading-relaxed text-white/90">
            Pick your event and drill the exact cluster exam it uses. Climb the leaderboard, challenge friends and train with your chapter.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href="#start" className="btn-white btn-lg">Continue as guest</a>
            <Link to="/register" className="btn-outline-white btn-lg">Create account</Link>
          </div>
        </div>
      </section>
      <ClusterMarquee />

      <section id="start" className="grid gap-10 pt-16 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="text-2xl">Continue as a guest</h2>
          <p className="mt-2 text-sm text-ink-3">Choose the event you compete in. Your home page and practice will be built around its exam.</p>
          <div className="mt-6">
            <EventPicker value={code} onChange={setCode} />
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <button className="btn-primary btn-lg" disabled={!ev} onClick={() => startGuest(code)}>
              Start practicing
            </button>
            {ev && (
              <p className="text-sm text-ink-2">
                <span className="font-semibold text-ink">{ev.code}</span> uses the {examOf(ev.exam).name} exam.
              </p>
            )}
          </div>
        </div>

        <aside className="h-fit bg-navy-midnight p-8 text-white">
          <h2 className="text-2xl text-white">Make it count with an account</h2>
          <ul className="mt-5 space-y-3 text-sm text-white/85">
            {['Save your ELO, streaks and exam history', 'Appear on the player leaderboard', 'Join your chapter with a code, or start one', 'Challenge other players in the Arena'].map((t) => (
              <li key={t} className="flex gap-2.5">
                <CheckCircle size={18} weight="fill" className="mt-px shrink-0 text-tint-3" />
                {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="btn-white">Create account</Link>
            <Link to="/login" className="btn-outline-white">Log in</Link>
          </div>
        </aside>
      </section>
    </div>
  )
}
