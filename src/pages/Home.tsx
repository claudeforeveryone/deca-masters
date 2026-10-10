import { Link } from 'react-router-dom'
import { Flame, Target, Swords, CalendarDays, Infinity as InfinityIcon, ArrowRight, BookOpen } from 'lucide-react'
import { ANNOUNCEMENTS, EVENTS, ME, MY_STATS, PLAYERS } from '../data/mock'
import { PlayerRow, Sparkline, StatCard } from '../components/ui'

export default function Home() {
  const weakest = [...MY_STATS.bySection].sort((a, b) => a.accuracy - b.accuracy)[0]
  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-navy-700 to-deca p-6 text-white sm:p-10">
        <div className="absolute -right-16 -top-16 h-64 w-64 rotate-45 rounded-3xl bg-white/5" />
        <div className="absolute -bottom-20 right-24 h-48 w-48 rotate-45 rounded-3xl bg-deca-light/20" />
        <div className="relative max-w-2xl">
          <p className="text-sm font-semibold text-sky-200">Welcome back, {ME.name.split(' ')[0]} 👋</p>
          <h1 className="mt-2 text-3xl font-extrabold leading-tight sm:text-4xl">
            Master every DECA cluster exam.
          </h1>
          <p className="mt-3 text-sky-100">
            Practice official-style questions, climb the ELO ladder, challenge friends in the Arena and train with your chapter.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/play" className="btn bg-white text-navy hover:bg-sky-100">Start practicing <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/arena" className="btn border border-white/30 text-white hover:bg-white/10"><Swords className="h-4 w-4" /> Challenge someone</Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="ELO" value={ME.elo} sub={`Rank #${MY_STATS.rank} global`} />
        <StatCard label="Streak" value={`${MY_STATS.streak} days`} sub={`Best: ${MY_STATS.bestStreak}`} icon={<Flame className="h-5 w-5" />} />
        <StatCard label="Accuracy" value={`${MY_STATS.accuracy}%`} sub={`${MY_STATS.questionsDone} questions`} icon={<Target className="h-5 w-5" />} />
        <StatCard label="Arena" value={`${MY_STATS.arenaRecord.w}W – ${MY_STATS.arenaRecord.l}L`} icon={<Swords className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Quick modes */}
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { icon: CalendarDays, title: 'Daily Challenge', desc: '10 questions, new every day', to: '/play?mode=daily' },
              { icon: InfinityIcon, title: 'Endless', desc: 'Keep going until you miss 3', to: '/play?mode=endless' },
              { icon: Target, title: 'Weak Spots', desc: `Focus: ${EVENTS.find((e) => e.id === weakest.event)!.name}`, to: '/play?mode=weak' },
            ].map(({ icon: Icon, title, desc, to }) => (
              <Link key={title} to={to} className="card group p-5 transition hover:-translate-y-0.5 hover:border-deca">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-100 text-deca group-hover:bg-deca group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 font-bold">{title}</h3>
                <p className="muted">{desc}</p>
              </Link>
            ))}
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="section-title">ELO progress</h2>
              <span className="chip">+{ME.elo - MY_STATS.eloHistory[0]} this season</span>
            </div>
            <Sparkline data={MY_STATS.eloHistory} className="mt-4 h-32 w-full" />
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="section-title">From your chapter</h2>
              <Link to="/chapter" className="text-sm font-semibold text-deca">Open classroom →</Link>
            </div>
            <ul className="mt-3 divide-y divide-sky-100">
              {ANNOUNCEMENTS.slice(0, 2).map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-center gap-2">
                    <span className="chip">{a.type}</span>
                    <span className="text-xs text-navy/50">{a.author} · {a.date}</span>
                  </div>
                  <p className="mt-1 font-semibold">{a.title}</p>
                  <p className="muted line-clamp-2">{a.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Top players</h2>
              <Link to="/leaderboard" className="text-sm font-semibold text-deca">View all</Link>
            </div>
            <div className="mt-3 space-y-1">
              {PLAYERS.slice(0, 5).map((p, i) => <PlayerRow key={p.id} p={p} rank={i + 1} />)}
            </div>
          </div>
          <Link to="/vocab" className="card flex items-center gap-4 bg-navy p-5 text-white">
            <BookOpen className="h-8 w-8 text-deca-light" />
            <div>
              <p className="font-bold">Vocab of the day</p>
              <p className="text-sm text-sky-200">Opportunity cost — tap to review your deck</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}
