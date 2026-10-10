import { useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { CHAPTERS, ME, PLAYERS } from '../data/mock'
import { Avatar, EmptyState, PageBand, Tabs } from '../components/ui'

const TABS = ['Players', 'Chapters'] as const

export default function Leaderboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Players')
  const [q, setQ] = useState('')
  const players = PLAYERS.filter((p) => `${p.name} ${p.school}`.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <PageBand
        tag="Rankings"
        title="Leaderboard"
        description="Players are ranked by ELO. Chapters are ranked by the combined ELO of every member."
      />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <Tabs options={TABS} value={tab} onChange={setTab} />
        {tab === 'Players' && (
          <label className="relative block sm:w-72">
            <span className="sr-only">Search players</span>
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
            <input className="input pl-9" placeholder="Search by name or school" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
        )}
      </div>

      {tab === 'Players' ? (
        <>
          <ol className="mb-10 grid gap-px bg-line sm:grid-cols-3">
            {PLAYERS.slice(0, 3).map((p, i) => (
              <li key={p.id} className={`flex items-center gap-4 p-6 ${i === 0 ? 'bg-brand text-white' : 'bg-canvas'}`}>
                <span className={`num text-4xl font-extrabold ${i === 0 ? 'text-white' : 'text-brand'}`}>{i + 1}</span>
                <Avatar name={p.name} size={44} inverse={i === 0} />
                <div className="min-w-0">
                  <p className={`truncate font-semibold ${i === 0 ? 'text-white' : 'text-ink'}`}>{p.name}</p>
                  <p className={`num text-sm ${i === 0 ? 'text-white/85' : 'text-ink-3'}`}>{p.elo.toLocaleString()} ELO</p>
                </div>
              </li>
            ))}
          </ol>

          {players.length === 0 ? (
            <div className="panel"><EmptyState icon={<MagnifyingGlass size={20} />} title="No players match" body="Try a different name or school." /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="w-14 py-3 pr-4">#</th>
                    <th className="py-3 pr-4">Player</th>
                    <th className="hidden py-3 pr-4 md:table-cell">School</th>
                    <th className="hidden py-3 pr-4 sm:table-cell">Grade</th>
                    <th className="py-3 text-right">ELO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {players.map((p) => {
                    const rank = PLAYERS.indexOf(p) + 1
                    const me = p.id === ME.id
                    return (
                      <tr key={p.id} className={me ? 'bg-tint' : 'hover:bg-canvas'}>
                        <td className={`num py-3.5 pl-1 pr-4 font-semibold ${rank <= 3 ? 'text-brand' : 'text-ink-3'}`}>{rank}</td>
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={p.name} size={30} />
                            <span className="font-semibold text-ink">{p.name}{me && <span className="ml-1.5 text-xs font-medium text-ink-3">(you)</span>}</span>
                          </div>
                        </td>
                        <td className="hidden py-3.5 pr-4 text-ink-2 md:table-cell">{p.school}</td>
                        <td className="num hidden py-3.5 pr-4 text-ink-2 sm:table-cell">{p.grade}</td>
                        <td className="num py-3.5 pr-1 text-right font-semibold text-ink">{p.elo.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="w-14 py-3 pr-4">#</th>
                <th className="py-3 pr-4">Chapter</th>
                <th className="hidden py-3 pr-4 md:table-cell">President</th>
                <th className="py-3 pr-4">Members</th>
                <th className="py-3 text-right">Total ELO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {CHAPTERS.map((c, i) => {
                const mine = c.name === ME.chapter
                return (
                  <tr key={c.id} className={mine ? 'bg-tint' : 'hover:bg-canvas'}>
                    <td className={`num py-4 pl-1 pr-4 font-semibold ${i < 3 ? 'text-brand' : 'text-ink-3'}`}>{i + 1}</td>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-ink">{c.name}{mine && <span className="ml-1.5 text-xs font-medium text-ink-3">(yours)</span>}</p>
                      <p className="text-xs text-ink-3">{c.school}</p>
                    </td>
                    <td className="hidden py-4 pr-4 text-ink-2 md:table-cell">{c.president}</td>
                    <td className="num py-4 pr-4 text-ink-2">{c.members}</td>
                    <td className="num py-4 pr-1 text-right font-semibold text-ink">{c.totalElo.toLocaleString()}</td>
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
