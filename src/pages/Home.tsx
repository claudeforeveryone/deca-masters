import { Link } from 'react-router-dom'
import { ArrowRight, CalendarCheck, Infinity as InfinityIcon, Crosshair, Flame, Sword, Megaphone, Newspaper, LinkSimple } from '@phosphor-icons/react'
import { ANNOUNCEMENTS, ME, MY_STATS, PLAYERS, VOCAB, eventName } from '../data/mock'
import { EloChart, RankRow, Stat } from '../components/ui'

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Home() {
  const weakest = [...MY_STATS.bySection].sort((a, b) => a.accuracy - b.accuracy)[0]
  const gain = ME.elo - MY_STATS.eloHistory[0]
  const myIdx = PLAYERS.findIndex((p) => p.id === ME.id)
  const word = VOCAB[0]

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold sm:text-[28px]">
            {greeting()}, {ME.name.split(' ')[0]}
          </h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-ink-3">
            <Flame size={16} weight="fill" className="text-brand" />
            {MY_STATS.streak}-day streak. Today’s daily challenge is ready.
          </p>
        </div>
        <Link to="/play?mode=daily" className="btn-primary btn-lg self-start sm:self-auto">
          Start daily <ArrowRight size={16} />
        </Link>
      </section>

      <section className="surface grid grid-cols-2 gap-y-6 p-5 sm:p-6 md:grid-cols-4 md:divide-x md:divide-line">
        <div className="md:pr-6"><Stat label="ELO" value={ME.elo.toLocaleString()} hint={`#${MY_STATS.rank} globally`} /></div>
        <div className="md:px-6"><Stat label="Accuracy" value={`${MY_STATS.accuracy}%`} hint={`${MY_STATS.questionsDone.toLocaleString()} questions`} /></div>
        <div className="md:px-6"><Stat label="Streak" value={`${MY_STATS.streak} days`} hint={`Best ${MY_STATS.bestStreak}`} /></div>
        <div className="md:pl-6"><Stat label="Arena" value={`${MY_STATS.arenaRecord.w}-${MY_STATS.arenaRecord.l}`} hint="Wins and losses" /></div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* Practice modes: one featured tile + two compact */}
          <section className="grid gap-3 sm:grid-cols-2">
            <Link to="/play?mode=daily" className="group row-span-2 flex flex-col justify-between rounded-xl bg-ink p-6 text-white transition-colors hover:bg-[#10284a]">
              <CalendarCheck size={26} className="text-tint-3" />
              <div className="mt-10">
                <p className="text-lg font-semibold">Daily challenge</p>
                <p className="mt-1 text-sm text-white/65">10 questions across every cluster. Same set for everyone today.</p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-tint-3 group-hover:text-white">
                  Play now <ArrowRight size={15} />
                </span>
              </div>
            </Link>
            <ModeTile to="/play?mode=weak" icon={<Crosshair size={20} />} title="Weak spots" body={`Focus on ${eventName(weakest.event)}, your lowest at ${weakest.accuracy}%.`} />
            <ModeTile to="/play?mode=endless" icon={<InfinityIcon size={20} />} title="Endless" body="Questions keep coming until you stop." />
          </section>

          <section className="surface p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="h-section">ELO this season</h2>
              <span className="num text-sm text-good">+{gain}</span>
            </div>
            <div className="mt-5">
              <EloChart data={MY_STATS.eloHistory} />
            </div>
          </section>

          <section className="surface">
            <div className="flex items-center justify-between px-5 pt-5 sm:px-6">
              <h2 className="h-section">Chapter updates</h2>
              <Link to="/chapter" className="link text-sm">Classroom</Link>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {ANNOUNCEMENTS.map((a) => {
                const Icon = a.type === 'Link' ? LinkSimple : a.type === 'Newsletter' ? Newspaper : Megaphone
                return (
                  <li key={a.id} className="flex gap-4 px-5 py-4 sm:px-6">
                    <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint text-brand"><Icon size={16} /></span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{a.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-sm text-ink-3">{a.body}</p>
                      <p className="mt-1 text-xs text-ink-3">{a.author}, {a.date}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="surface p-2">
            <div className="flex items-center justify-between px-3 pb-2 pt-3">
              <h2 className="h-section">Top players</h2>
              <Link to="/leaderboard" className="link text-sm">View all</Link>
            </div>
            {PLAYERS.slice(0, 5).map((p, i) => <RankRow key={p.id} p={p} rank={i + 1} />)}
            <div className="mx-3 my-1 border-t border-dashed border-line" />
            <RankRow p={ME} rank={myIdx + 1} me />
          </section>

          <section className="rounded-xl bg-tint p-5">
            <p className="text-[13px] font-medium text-brand">Word of the day</p>
            <p className="mt-2 text-lg font-semibold">{word.term}</p>
            <p className="mt-1 text-sm text-ink-2">{word.def}</p>
            <Link to="/vocab" className="link mt-4 inline-flex items-center gap-1 text-sm">
              Review vocab <ArrowRight size={14} />
            </Link>
          </section>

          <Link to="/arena" className="surface flex items-center gap-4 p-5 transition-colors hover:border-line-strong">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-brand"><Sword size={20} /></span>
            <div className="flex-1">
              <p className="text-sm font-semibold">2 Arena challenges</p>
              <p className="text-sm text-ink-3">Maya and Noah are waiting</p>
            </div>
            <ArrowRight size={16} className="text-ink-3" />
          </Link>
        </aside>
      </div>
    </div>
  )
}

function ModeTile({ to, icon, title, body }: { to: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link to={to} className="surface group flex gap-4 p-5 transition-colors hover:border-brand/40">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint text-brand">{icon}</span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-ink-3">{body}</p>
      </div>
    </Link>
  )
}
