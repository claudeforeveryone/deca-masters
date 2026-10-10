import { useState } from 'react'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { CLUSTERS, eventByCode, type ClusterId } from '../data/events'
import { useStore } from '../store'
import { Avatar, EmptyState, PageBand, Tabs } from '../components/ui'

const TABS = ['Players', 'Chapters'] as const
const PAGE = 50

export default function Leaderboard() {
  const { players, chapters, myChapter, isGuest } = useStore()
  const [tab, setTab] = useState<(typeof TABS)[number]>('Players')
  const [q, setQ] = useState('')
  const [cluster, setCluster] = useState<ClusterId | 'all'>('all')
  const [shown, setShown] = useState(PAGE)

  const ranked = players.map((p, i) => ({ p, rank: p.elo > 0 ? i + 1 : 0 }))
  const filtered = ranked.filter(({ p }) => {
    const ev = eventByCode(p.eventCode)
    return `${p.name} ${p.school} ${p.eventCode}`.toLowerCase().includes(q.toLowerCase()) && (cluster === 'all' || ev?.cluster === cluster)
  })

  return (
    <div>
      <PageBand tag="Rankings" title="Leaderboard" description="Players are ranked by ELO. Chapters are ranked by the combined ELO of every member." />

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <Tabs options={TABS} value={tab} onChange={setTab} />
        {tab === 'Players' && (
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="relative block sm:w-64">
              <span className="sr-only">Search players</span>
              <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
              <input className="input pl-9" placeholder="Search name, school or event" value={q} onChange={(e) => { setQ(e.target.value); setShown(PAGE) }} />
            </label>
            <label className="sr-only" htmlFor="lb-cluster">Career cluster</label>
            <select id="lb-cluster" className="input sm:w-64" value={cluster} onChange={(e) => { setCluster(e.target.value as ClusterId | 'all'); setShown(PAGE) }}>
              <option value="all">All career clusters</option>
              {CLUSTERS.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {isGuest && tab === 'Players' && (
        <p className="mb-6 border-l-4 border-brand bg-tint px-4 py-3 text-sm text-ink-2">Guests are not ranked. Create an account to put your ELO on the board.</p>
      )}

      {tab === 'Players' ? (
        filtered.length === 0 ? (
          <div className="panel"><EmptyState icon={<MagnifyingGlass size={20} />} title="No players match" body="Try a different name, school or cluster." /></div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="table-head">
                  <tr>
                    <th className="w-14 py-3 pr-4">#</th>
                    <th className="py-3 pr-4">Player</th>
                    <th className="hidden py-3 pr-4 md:table-cell">School</th>
                    <th className="hidden py-3 pr-4 sm:table-cell">Event</th>
                    <th className="hidden py-3 pr-4 lg:table-cell">Grade</th>
                    <th className="py-3 text-right">ELO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.slice(0, shown).map(({ p, rank }) => {
                    const ev = eventByCode(p.eventCode)
                    const color = CLUSTERS.find((c) => c.id === ev?.cluster)?.color
                    return (
                      <tr key={p.id} className={p.isMe ? 'bg-tint' : 'hover:bg-canvas'}>
                        <td className={`num py-3.5 pl-1 pr-4 font-semibold ${rank > 0 && rank <= 3 ? 'text-brand' : 'text-ink-3'}`}>{rank}</td>
                        <td className="py-3.5 pr-4">
                          <div className="flex items-center gap-3">
                            <Avatar name={p.name} size={30} />
                            <span className="font-semibold text-ink">{p.name}{p.isMe && <span className="ml-1.5 text-xs font-medium text-ink-3">(you)</span>}</span>
                          </div>
                        </td>
                        <td className="hidden py-3.5 pr-4 text-ink-2 md:table-cell">{p.school}</td>
                        <td className="hidden py-3.5 pr-4 sm:table-cell">
                          <span className="inline-flex items-center gap-2 text-ink-2"><span className="h-2.5 w-2.5" style={{ background: color }} aria-hidden />{p.eventCode}</span>
                        </td>
                        <td className="num hidden py-3.5 pr-4 text-ink-2 lg:table-cell">{p.grade}</td>
                        <td className="num py-3.5 pr-1 text-right font-semibold text-ink">{p.elo.toLocaleString()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-6 flex items-center justify-between text-sm text-ink-3">
              <span>Showing {Math.min(shown, filtered.length)} of {filtered.length} players</span>
              {shown < filtered.length && <button className="btn-secondary" onClick={() => setShown(shown + PAGE)}>Show more</button>}
            </div>
          </>
        )
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="table-head">
              <tr>
                <th className="w-14 py-3 pr-4">#</th>
                <th className="py-3 pr-4">Chapter</th>
                <th className="py-3 pr-4">Members</th>
                <th className="py-3 text-right">Total ELO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {chapters.map((c, i) => {
                const mine = c.id === myChapter?.id
                const rank = c.totalElo > 0 ? i + 1 : 0
                return (
                  <tr key={c.id} className={mine ? 'bg-tint' : 'hover:bg-canvas'}>
                    <td className={`num py-4 pl-1 pr-4 font-semibold ${rank > 0 && rank <= 3 ? 'text-brand' : 'text-ink-3'}`}>{rank}</td>
                    <td className="py-4 pr-4">
                      <p className="font-semibold text-ink">{c.name}{mine && <span className="ml-1.5 text-xs font-medium text-ink-3">(yours)</span>}</p>
                      <p className="text-xs text-ink-3">{c.school}</p>
                    </td>
                    <td className="num py-4 pr-4 text-ink-2">{c.members.length}</td>
                    <td className="num py-4 pr-1 text-right font-semibold text-ink">{c.totalElo.toLocaleString()}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-10 text-xs text-ink-3">The other players and chapters shown are demo accounts for testing the site.</p>
    </div>
  )
}
