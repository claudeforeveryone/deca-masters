import { useState } from 'react'
import { MagnifyingGlass, Users } from '@phosphor-icons/react'
import { CHAPTERS, ME, PLAYERS } from '../data/mock'
import { Avatar, EmptyState, PageHeader, Segmented } from '../components/ui'

const TABS = ['Players', 'Chapters'] as const

export default function Leaderboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Players')
  const [q, setQ] = useState('')
  const players = PLAYERS.filter((p) => `${p.name} ${p.school}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        description={tab === 'Players' ? 'Every player, ranked by ELO.' : 'Chapters ranked by the combined ELO of all members.'}
        actions={<Segmented options={TABS} value={tab} onChange={setTab} />}
      />

      {tab === 'Players' ? (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          {/* Top three */}
          <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:content-start">
            {PLAYERS.slice(0, 3).map((p, i) => (
              <li key={p.id} className={`flex items-center gap-4 rounded-xl p-4 ${i === 0 ? 'bg-ink text-white' : 'surface'}`}>
                <span className={`num text-2xl font-semibold ${i === 0 ? 'text-tint-3' : 'text-ink-3'}`}>{i + 1}</span>
                <Avatar name={p.name} size={40} />
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className={`num text-sm ${i === 0 ? 'text-white/70' : 'text-ink-3'}`}>{p.elo.toLocaleString()} ELO</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="surface overflow-hidden">
            <div className="border-b border-line p-3">
              <label className="relative block">
                <span className="sr-only">Search players</span>
                <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
                <input className="input pl-9" placeholder="Search by name or school" value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
            </div>
            {players.length === 0 ? (
              <EmptyState icon={<MagnifyingGlass size={18} />} title="No players match" body="Try a different name or school." />
            ) : (
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="w-14 px-4 py-2.5 font-medium">#</th>
                    <th className="px-2 py-2.5 font-medium">Player</th>
                    <th className="hidden px-4 py-2.5 font-medium md:table-cell">School</th>
                    <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Grade</th>
                    <th className="px-4 py-2.5 text-right font-medium">ELO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {players.map((p) => {
                    const rank = PLAYERS.indexOf(p) + 1
                    const me = p.id === ME.id
                    return (
                      <tr key={p.id} className={me ? 'bg-tint' : 'hover:bg-canvas'}>
                        <td className={`num px-4 py-3 ${rank <= 3 ? 'font-semibold text-brand' : 'text-ink-3'}`}>{rank}</td>
                        <td className="px-2 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={p.name} size={28} />
                            <span className="font-medium">{p.name}{me && <span className="ml-1.5 font-normal text-ink-3">(you)</span>}</span>
                          </div>
                        </td>
                        <td className="hidden px-4 py-3 text-ink-2 md:table-cell">{p.school}</td>
                        <td className="num hidden px-4 py-3 text-ink-2 sm:table-cell">{p.grade}</td>
                        <td className="num px-4 py-3 text-right font-medium">{p.elo.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="w-14 px-4 py-2.5 font-medium">#</th>
                <th className="px-2 py-2.5 font-medium">Chapter</th>
                <th className="hidden px-4 py-2.5 font-medium md:table-cell">President</th>
                <th className="px-4 py-2.5 font-medium">Members</th>
                <th className="px-4 py-2.5 text-right font-medium">Total ELO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {CHAPTERS.map((c, i) => {
                const mine = c.name === ME.chapter
                return (
                  <tr key={c.id} className={mine ? 'bg-tint' : 'hover:bg-canvas'}>
                    <td className={`num px-4 py-3.5 ${i < 3 ? 'font-semibold text-brand' : 'text-ink-3'}`}>{i + 1}</td>
                    <td className="px-2 py-3.5">
                      <p className="font-medium">{c.name}{mine && <span className="ml-1.5 font-normal text-ink-3">(yours)</span>}</p>
                      <p className="text-xs text-ink-3">{c.school}</p>
                    </td>
                    <td className="hidden px-4 py-3.5 text-ink-2 md:table-cell">{c.president}</td>
                    <td className="px-4 py-3.5">
                      <span className="num inline-flex items-center gap-1.5 text-ink-2"><Users size={14} /> {c.members}</span>
                    </td>
                    <td className="num px-4 py-3.5 text-right font-medium">{c.totalElo.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
