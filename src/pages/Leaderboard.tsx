import { useState } from 'react'
import { Users } from 'lucide-react'
import { CHAPTERS, ME, PLAYERS } from '../data/mock'
import { PageHeader, PlayerRow, Tabs } from '../components/ui'

const TABS = ['Players', 'Chapters'] as const

export default function Leaderboard() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Players')
  const [q, setQ] = useState('')
  const players = PLAYERS.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Players ranked by ELO. Chapters ranked by the combined ELO of every member."
        action={<Tabs tabs={TABS} value={tab} onChange={setTab} />}
      />

      {tab === 'Players' ? (
        <>
          {/* Podium */}
          <div className="mb-6 grid grid-cols-3 items-end gap-3 sm:gap-6">
            {[1, 0, 2].map((idx) => {
              const p = PLAYERS[idx]
              const h = idx === 0 ? 'h-36' : idx === 1 ? 'h-28' : 'h-20'
              return (
                <div key={p.id} className="text-center">
                  <img src={p.avatar} className="mx-auto h-14 w-14 rounded-full ring-4 ring-white shadow-card" alt="" />
                  <p className="mt-2 truncate text-sm font-bold">{p.name}</p>
                  <p className="text-xs font-semibold text-deca">{p.elo} ELO</p>
                  <div className={`mt-2 ${h} rounded-t-2xl ${idx === 0 ? 'bg-deca' : 'bg-navy-700'} grid place-items-center text-3xl font-extrabold text-white`}>
                    {idx + 1}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="card p-4">
            <input className="input mb-3" placeholder="Search players…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="space-y-1">
              {players.map((p) => (
                <PlayerRow
                  key={p.id}
                  p={p}
                  rank={PLAYERS.indexOf(p) + 1}
                  highlight={p.id === ME.id}
                  right={
                    <div className="flex items-center gap-4">
                      <span className="hidden text-xs text-navy/50 sm:inline">{p.school} · Gr {p.grade}</span>
                      <span className="w-14 text-right text-sm font-bold text-deca">{p.elo}</span>
                    </div>
                  }
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-navy text-left text-xs uppercase tracking-wide text-sky-200">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Chapter</th>
                <th className="hidden px-4 py-3 sm:table-cell">President</th>
                <th className="px-4 py-3">Members</th>
                <th className="px-4 py-3 text-right">Total ELO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sky-100">
              {CHAPTERS.map((c, i) => (
                <tr key={c.id} className={c.name === ME.chapter ? 'bg-sky-100' : ''}>
                  <td className="px-4 py-3 font-bold">{i + 1}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-xs text-navy/50">{c.school}</p>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">{c.president}</td>
                  <td className="px-4 py-3"><span className="chip"><Users className="h-3 w-3" />{c.members}</span></td>
                  <td className="px-4 py-3 text-right font-extrabold text-deca">{c.totalElo.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
