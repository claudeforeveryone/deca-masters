import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { MagnifyingGlass, CheckCircle, ArrowCircleRight, BookOpen } from '@phosphor-icons/react'
import { EXAMS, examOf, type ExamId } from '../data/events'
import { LEVELS, LEVEL_FILTERS, LEVEL_ORDER, PAST_EXAMS, examTitle, type PastExam } from '../data/exams'
import { useMyEvent, useStore } from '../store'
import { EmptyState, PageBand } from '../components/ui'

/** Past DECA exams, by cluster, then year, then conference level. */
export default function Exams() {
  const { me } = useStore()
  const { exam: myExam } = useMyEvent()
  const [params, setParams] = useSearchParams()
  const cluster = (EXAMS.some((x) => x.id === params.get('cluster')) ? params.get('cluster') : myExam) as ExamId
  const filter = LEVEL_FILTERS.find((f) => f.key === params.get('level')) ?? LEVEL_FILTERS[0]
  const [query, setQuery] = useState('')

  const set = (next: Record<string, string>) => setParams({ cluster, level: filter.key, ...next }, { replace: true })

  // Best score on each exam you have taken.
  const best = useMemo(() => {
    const m = new Map<string, number>()
    for (const h of me!.progress.history) {
      if (!h.pastExam || !h.total) continue
      m.set(h.pastExam, Math.max(m.get(h.pastExam) ?? 0, Math.round((h.correct / h.total) * 100)))
    }
    return m
  }, [me])

  const inCluster = PAST_EXAMS.filter((x) => x.cluster === cluster)
  const q = query.trim().toLowerCase()
  const shown = inCluster.filter((x) => filter.levels.includes(x.level) && (!q || `${x.test ?? ''} ${x.year ?? ''} ${LEVELS[x.level].label}`.toLowerCase().includes(q)))

  // Newest year first; numbered booklets with no known year go last.
  const groups = useMemo(() => {
    const by = new Map<string, PastExam[]>()
    for (const x of shown) {
      const k = x.year ? String(x.year) : 'More past tests'
      by.set(k, [...(by.get(k) ?? []), x])
    }
    for (const list of by.values()) list.sort((a, b) => LEVEL_ORDER.indexOf(a.level) - LEVEL_ORDER.indexOf(b.level) || Number(a.test ?? 0) - Number(b.test ?? 0))
    return [...by.entries()].sort(([a], [b]) => (Number(b) || 0) - (Number(a) || 0))
  }, [shown])

  const info = examOf(cluster)
  const total = inCluster.reduce((s, x) => s + x.count, 0)
  const icdc = inCluster.filter((x) => x.level === 'ICDC').length

  return (
    <div>
      <PageBand
        tag="Past exams"
        title="Exams"
        description="Real DECA cluster exams from past ICDCs, state and provincial conferences, regionals and official samples. Pick a year and take the whole test."
      />

      <div className="-mx-4 mb-8 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Cluster">
        {EXAMS.map((x) => {
          const on = x.id === cluster
          const n = PAST_EXAMS.filter((e) => e.cluster === x.id).length
          return (
            <button
              key={x.id}
              role="tab"
              aria-selected={on}
              onClick={() => set({ cluster: x.id, level: 'all' })}
              className={`shrink-0 rounded-soft border-2 px-3 py-1.5 text-[13px] font-semibold transition-colors ${on ? '' : 'border-line text-ink-2 hover:border-line-strong'}`}
              style={on ? { background: x.color, borderColor: x.color, color: x.fg } : undefined}
            >
              {x.name} <span className="num ml-1 opacity-75">{n}</span>
            </button>
          )
        })}
      </div>

      <div className="mb-6 flex flex-col gap-4 border-b border-line pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl">{info.name}</h2>
          <p className="mt-1 text-sm text-ink-3">
            {inCluster.length} exams, {total.toLocaleString()} questions{icdc ? `, ${icdc} from ICDC` : ''}.{' '}
            <Link to={`/bank?exam=${cluster}`} className="link">Search every question</Link>
          </p>
        </div>
        <label className="relative block lg:w-72">
          <span className="sr-only">Find an exam by year or test number</span>
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input className="input pl-9" inputMode="numeric" placeholder="Year or test number, e.g. 1088" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>

      <div className="mb-10 flex flex-wrap gap-2" aria-label="Conference level">
        {LEVEL_FILTERS.map((f) => {
          const n = inCluster.filter((x) => f.levels.includes(x.level)).length
          if (f.key !== 'all' && n === 0) return null
          const on = f.key === filter.key
          return (
            <button key={f.key} aria-pressed={on} onClick={() => set({ level: f.key })} className={on ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}>
              {f.label} <span className="num opacity-75">{n}</span>
            </button>
          )
        })}
      </div>

      {groups.length === 0 ? (
        <div className="panel">
          <EmptyState icon={<BookOpen size={20} />} title="No exams match" body="Try another year, test number or level." />
        </div>
      ) : (
        <div className="space-y-12">
          {groups.map(([year, list]) => (
            <section key={year} aria-labelledby={`y-${year}`}>
              <div className="mb-4 flex items-baseline gap-3">
                <h3 id={`y-${year}`} className="num text-3xl font-extrabold tracking-head">{year}</h3>
                <span className="text-sm text-ink-3">{list.length} {list.length === 1 ? 'exam' : 'exams'}</span>
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {list.map((x) => {
                  const score = best.get(x.id)
                  return (
                    <li key={x.id}>
                      <Link
                        to={`/exams/${x.id}`}
                        className="group relative flex h-full flex-col overflow-hidden rounded-box border border-line bg-white p-5 pl-6 transition-colors hover:border-brand hover:bg-tint"
                      >
                        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: info.color }} aria-hidden />
                        <span className="flex items-center justify-between gap-2">
                          <span className={x.level === 'ICDC' ? 'badge' : 'badge-neutral'}>{LEVELS[x.level].label}</span>
                          {score !== undefined && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-good"><CheckCircle size={15} weight="fill" /> {score}%</span>
                          )}
                        </span>
                        <span className="mt-3 text-lg font-semibold tracking-head text-ink">{examTitle(x)}</span>
                        <span className="mt-0.5 text-xs text-ink-3">{x.test && x.year ? `Test ${x.test}` : LEVELS[x.level].blurb}</span>
                        <span className="mt-4 flex items-center justify-between gap-2 text-sm">
                          <span className="num text-ink-2">
                            {x.count} questions{x.explained >= x.count * 0.8 ? ', explained' : ''}
                          </span>
                          <ArrowCircleRight size={22} weight="fill" className="shrink-0 text-brand transition-transform group-hover:translate-x-0.5" />
                        </span>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
