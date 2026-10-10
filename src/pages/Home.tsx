import { Link } from 'react-router-dom'
import { Flame, Megaphone, Newspaper, LinkSimple } from '@phosphor-icons/react'
import { ANNOUNCEMENTS, ME, MY_STATS, PLAYERS, eventName } from '../data/mock'
import { ArrowLink, Avatar, ClusterBar, EloChart, RankRow, SectionHeader } from '../components/ui'

export default function Home() {
  const weakest = [...MY_STATS.bySection].sort((a, b) => a.accuracy - b.accuracy)[0]
  const myIdx = PLAYERS.findIndex((p) => p.id === ME.id)
  const chapterRank = PLAYERS.filter((p) => p.chapter === ME.chapter).findIndex((p) => p.id === ME.id) + 1

  const MODES = [
    { title: 'Daily challenge', body: '10 questions across every cluster. The same set for everyone today.', to: '/play?mode=daily', cta: 'Play daily' },
    { title: 'Weak spots', body: `Targets ${eventName(weakest.event)}, where you are at ${weakest.accuracy}% accuracy.`, to: '/play?mode=weak', cta: 'Fix weak spots' },
    { title: 'Endless', body: 'Questions keep coming from every cluster until you stop.', to: '/play?mode=endless', cta: 'Start endless' },
    { title: 'Practice exams', body: 'Full 100-question cluster exams with a timer, scored like the real thing.', to: '/play', cta: 'Browse exams' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="bleed diamond-pattern bg-brand text-white">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.3fr_1fr] lg:py-20">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Flame size={18} weight="fill" /> {MY_STATS.streak}-day streak
            </p>
            <h1 className="display mt-4 text-[40px] sm:text-6xl">
              Ready for today’s
              <br />
              challenge, {ME.name.split(' ')[0]}?
            </h1>
            <p className="mt-5 max-w-[46ch] text-base leading-relaxed text-white/90">
              Ten new questions are waiting. Keep your streak alive and pick up ELO before the weekend.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link to="/play?mode=daily" className="btn-white btn-lg">Start daily</Link>
              <ArrowLink to="/leaderboard" inverse>View leaderboard</ArrowLink>
            </div>
          </div>

          <div className="bg-white p-6 text-ink-2 sm:p-8">
            <div className="flex items-center gap-3">
              <Avatar name={ME.name} size={44} />
              <div>
                <p className="font-semibold text-ink">{ME.name}</p>
                <p className="text-xs text-ink-3">{ME.chapter}</p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-px bg-line">
              {[
                ['ELO', ME.elo.toLocaleString()],
                ['Global rank', `#${MY_STATS.rank}`],
                ['Accuracy', `${MY_STATS.accuracy}%`],
                ['Arena', `${MY_STATS.arenaRecord.w}-${MY_STATS.arenaRecord.l}`],
              ].map(([k, v]) => (
                <div key={k} className="bg-white py-4 pr-4 [&:nth-child(even)]:pl-4">
                  <dt className="text-[11px] font-bold uppercase tracking-label text-ink-3">{k}</dt>
                  <dd className="num mt-1 text-2xl font-semibold tracking-head text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <EloChart data={MY_STATS.eloHistory} height={70} />
            </div>
          </div>
        </div>
      </section>
      <ClusterBar bleed />

      {/* Practice modes */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="tag">Practice</span>
          <h2 className="mt-4 text-3xl sm:text-4xl">Pick how you want to train today.</h2>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {MODES.map((m) => (
            <div key={m.title} className="panel flex flex-col p-8">
              <h3 className="text-lg text-brand">{m.title}</h3>
              <p className="mt-2 max-w-[48ch] text-sm leading-relaxed text-ink-2">{m.body}</p>
              <div className="mt-6"><ArrowLink to={m.to}>{m.cta}</ArrowLink></div>
            </div>
          ))}
        </div>
      </section>

      {/* Arena: navy split block */}
      <section className="grid md:grid-cols-2">
        <div className="bg-navy-midnight p-8 text-white sm:p-12">
          <span className="tag">Arena</span>
          <h2 className="mt-4 text-3xl text-white">Two players are waiting for you.</h2>
          <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-white/80">
            Ten questions, two and a half minutes. Most correct wins, and a tie goes to whoever finished faster.
          </p>
          <div className="mt-8"><ArrowLink to="/arena" inverse>Open the Arena</ArrowLink></div>
        </div>
        <ul className="divide-y divide-line border border-line border-t-0 md:border-l-0 md:border-t">
          {[PLAYERS[0], PLAYERS[7]].map((p, i) => (
            <li key={p.id} className="flex items-center gap-4 p-6 sm:px-8">
              <Avatar name={p.name} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{p.name}</p>
                <p className="text-xs text-ink-3">{i === 0 ? 'Marketing' : 'Mixed events'}, {p.elo.toLocaleString()} ELO</p>
              </div>
              <Link to="/arena" className="btn-primary btn-sm">Accept</Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Big number moment */}
      <section className="relative overflow-hidden py-24 text-center sm:py-36">
        <span aria-hidden className="num pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-[40vw] font-extrabold leading-none tracking-tighter text-[#DCEBF8] sm:text-[360px]">
          #{MY_STATS.rank}
        </span>
        <div className="relative mx-auto max-w-2xl">
          <p className="text-2xl font-medium leading-snug tracking-head text-ink sm:text-3xl">
            You are ranked #{MY_STATS.rank} of every player and #{chapterRank} in {ME.chapter}.
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-head text-ink sm:text-3xl">Ready to climb?</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            <Link to="/play" className="btn-secondary">Practice now</Link>
            <ArrowLink to="/me">See your stats</ArrowLink>
          </div>
        </div>
      </section>

      {/* Leaderboard + chapter feed */}
      <section className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <SectionHeader title="Top players" action={<ArrowLink to="/leaderboard">View all</ArrowLink>} />
          <div className="divide-y divide-line border border-line">
            {PLAYERS.slice(0, 5).map((p, i) => <RankRow key={p.id} p={p} rank={i + 1} />)}
            <RankRow p={ME} rank={myIdx + 1} me />
          </div>
        </div>
        <div>
          <SectionHeader title="From your chapter" action={<ArrowLink to="/chapter">Classroom</ArrowLink>} />
          <ul className="space-y-4">
            {ANNOUNCEMENTS.map((a) => {
              const Icon = a.type === 'Link' ? LinkSimple : a.type === 'Newsletter' ? Newspaper : Megaphone
              return (
                <li key={a.id} className="panel flex gap-4 p-5">
                  <Icon size={22} className="mt-0.5 shrink-0 text-brand" />
                  <div className="min-w-0">
                    <p className="font-semibold text-brand">{a.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-ink-2">{a.body}</p>
                    <p className="mt-2 text-xs text-ink-3">{a.author}, {a.date}</p>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </div>
  )
}
