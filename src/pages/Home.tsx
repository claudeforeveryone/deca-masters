import { Link } from 'react-router-dom'
import { Flame, Megaphone, Newspaper, LinkSimple, UsersThree } from '@phosphor-icons/react'
import { EXAMS, examOf } from '../data/events'
import { eloSeries, useMyEvent, useStore } from '../store'
import { ArrowLink, Avatar, ClusterMarquee, EloChart, EmptyState, RankRow, SectionHeader } from '../components/ui'

export default function Home() {
  const { me, isGuest, players, myRank, myChapter, chapterMeta } = useStore()
  const { event, exam } = useMyEvent()
  const p = me!.progress
  const myExam = examOf(exam)
  const accuracy = p.answered ? Math.round((p.correct / p.answered) * 100) : 0
  const attempted = EXAMS.filter((x) => (p.byExam[x.id]?.answered ?? 0) > 0)
  const weakest = [...attempted].sort((a, b) => {
    const acc = (id: typeof a.id) => (p.byExam[id]!.correct / p.byExam[id]!.answered)
    return acc(a.id) - acc(b.id)
  })[0]
  const online = players.filter((x) => x.online && !x.isMe).slice(0, 3)
  const posts = myChapter ? chapterMeta(myChapter.id).posts.slice(0, 3) : []
  const first = me!.name.split(' ')[0]

  const MODES = [
    { title: 'Daily challenge', body: `Today’s set from the ${myExam.name} exam. Same questions for everyone.`, to: '/play?mode=daily', cta: 'Play daily' },
    weakest
      ? { title: 'Weak spots', body: `Your lowest exam so far is ${weakest.name}. Drill it until it is not.`, to: '/play?mode=weak', cta: 'Fix weak spots' }
      : { title: 'Weak spots', body: 'Answer a few sessions of questions and we will point you at the exam you miss most.', to: '/play', cta: 'Start practicing' },
    { title: 'Endless', body: `Keep answering ${myExam.name} questions until you decide to stop.`, to: '/play?mode=endless', cta: 'Start endless' },
    { title: 'Full practice exam', body: 'Timed, no explanations until the end. Just like competition day.', to: '/play?mode=exam', cta: 'Take the exam' },
  ]

  return (
    <div>
      {/* Hero */}
      <section className="bleed diamond-pattern bg-brand text-white">
        <div className="container-page grid items-center gap-10 py-14 lg:grid-cols-[1.3fr_1fr] lg:py-20">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              {p.streak > 0 ? <><Flame size={18} weight="fill" /> {p.streak}-day streak</> : <>{isGuest ? 'Welcome' : `Welcome, ${first}`}</>}
            </p>
            <span className="mt-5 inline-flex rounded-soft border-2 border-white px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-label">{event.code}</span>
            <h1 className="display mt-3 text-4xl sm:text-5xl">{event.name}</h1>
            <p className="mt-5 max-w-[48ch] text-base leading-relaxed text-white/90">
              Your event uses the {myExam.name} exam. {p.answered ? `You have answered ${p.answered.toLocaleString()} questions so far.` : 'Start with today’s daily challenge.'}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-6">
              <Link to="/play?mode=daily" className="btn-white btn-lg">Start daily</Link>
              <ArrowLink to="/play?mode=exam" inverse>Take the full exam</ArrowLink>
            </div>
          </div>

          <div className="rounded-box bg-white p-6 text-ink-2 sm:p-8">
            <div className="flex items-center gap-3">
              <Avatar name={isGuest ? 'G' : me!.name} size={44} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{isGuest ? 'Guest session' : me!.name}</p>
                <p className="truncate text-xs text-ink-3">{isGuest ? 'Progress is kept on this device' : myChapter?.name ?? me!.school}</p>
              </div>
            </div>
            <dl className="mt-6 grid grid-cols-2 gap-px bg-line">
              {[
                ['ELO', p.elo.toLocaleString()],
                ['Global rank', isGuest ? '0' : String(myRank)],
                ['Accuracy', `${accuracy}%`],
                ['Questions', p.answered.toLocaleString()],
              ].map(([k, v]) => (
                <div key={k} className="bg-white py-4 pr-4 [&:nth-child(even)]:pl-4">
                  <dt className="text-[11px] font-bold uppercase tracking-label text-ink-3">{k}</dt>
                  <dd className="num mt-1 text-2xl font-semibold tracking-head text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <EloChart data={eloSeries(p.history)} height={70} />
            </div>
            {isGuest && <Link to="/register" className="btn-primary mt-5 w-full">Create account to save progress</Link>}
          </div>
        </div>
      </section>
      <ClusterMarquee />

      {/* Practice modes */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <span className="tag">Practice</span>
          <h2 className="mt-4 text-3xl sm:text-4xl">Train for {event.code} today.</h2>
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
        <div className="rounded-t-box bg-navy-midnight p-8 text-white sm:p-12 md:rounded-tr-none md:rounded-bl-box">
          <span className="tag">Arena</span>
          <h2 className="mt-4 text-3xl text-white">Challenge someone to a 1v1.</h2>
          <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-white/80">
            Two and a half minutes on the clock. Most correct wins, and a tie goes to whoever finished faster.
          </p>
          <div className="mt-8"><ArrowLink to="/arena" inverse>Open the Arena</ArrowLink></div>
        </div>
        <div className="rounded-none rounded-b-box border border-line border-t-0 md:rounded-r-box md:rounded-bl-none md:border-l-0 md:border-t">
          <p className="border-b border-line px-6 py-3 text-[11px] font-bold uppercase tracking-label text-ink-3 sm:px-8">Online now</p>
          <ul className="divide-y divide-line">
            {online.map((x) => (
              <li key={x.id} className="flex items-center gap-4 px-6 py-4 sm:px-8">
                <Avatar name={x.name} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-ink">{x.name}</p>
                  <p className="truncate text-xs text-ink-3">{x.eventCode}, {x.elo.toLocaleString()} ELO</p>
                </div>
                <Link to="/arena" className="btn-secondary btn-sm">Challenge</Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Big number moment */}
      <section className="relative overflow-hidden py-24 text-center sm:py-36">
        <span aria-hidden className="num pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 select-none text-[40vw] font-extrabold leading-none tracking-tighter text-tint-2/40 sm:text-[360px]">
          #{isGuest ? 0 : myRank}
        </span>
        <div className="relative mx-auto max-w-2xl">
          <p className="text-2xl font-medium leading-snug tracking-head text-ink sm:text-3xl">
            {isGuest
              ? 'Guests are not ranked. Create an account to join the leaderboard.'
              : myRank
                ? `You are ranked #${myRank} out of ${players.length} players.`
                : 'You are not ranked yet. Earn ELO by answering questions to get on the board.'}
          </p>
          <p className="mt-3 text-2xl font-semibold tracking-head text-ink sm:text-3xl">Ready to climb?</p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6">
            {isGuest ? <Link to="/register" className="btn-secondary">Create account</Link> : <Link to="/play" className="btn-secondary">Practice now</Link>}
            <ArrowLink to="/leaderboard">See the leaderboard</ArrowLink>
          </div>
        </div>
      </section>

      {/* Leaderboard + chapter */}
      <section className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <SectionHeader title="Top players" action={<ArrowLink to="/leaderboard">View all</ArrowLink>} />
          <div className="divide-y divide-line border border-line">
            {players.slice(0, 5).map((x, i) => <RankRow key={x.id} p={x} rank={i + 1} />)}
          </div>
        </div>
        <div>
          <SectionHeader title={myChapter ? `From ${myChapter.name}` : 'Your chapter'} action={myChapter ? <ArrowLink to="/chapter">Classroom</ArrowLink> : undefined} />
          {!myChapter ? (
            <div className="panel">
              <EmptyState
                icon={<UsersThree size={22} />}
                title={isGuest ? 'Chapters need an account' : 'You are not in a chapter yet'}
                body={isGuest ? 'Create an account, then join your chapter with its code or start a new one.' : 'Join with the code from your chapter president, or create a chapter for your school.'}
                action={<Link to={isGuest ? '/register' : '/chapter'} className="btn-primary">{isGuest ? 'Create account' : 'Join or create'}</Link>}
              />
            </div>
          ) : posts.length === 0 ? (
            <div className="panel"><EmptyState icon={<Megaphone size={22} />} title="No posts yet" body="Announcements, links and newsletters from your chapter officers will show up here." /></div>
          ) : (
            <ul className="space-y-4">
              {posts.map((a) => {
                const Icon = a.type === 'Link' ? LinkSimple : a.type === 'Newsletter' ? Newspaper : Megaphone
                return (
                  <li key={a.id} className="panel flex gap-4 p-5">
                    <Icon size={22} className="mt-0.5 shrink-0 text-brand" />
                    <div className="min-w-0">
                      <p className="font-semibold text-brand">{a.title}</p>
                      {a.body && <p className="mt-1 line-clamp-2 text-sm text-ink-2">{a.body}</p>}
                      <p className="mt-2 text-xs text-ink-3">{a.author}, {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
