import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowCircleRight, Briefcase, Lightbulb, CurrencyDollar, Globe, DeviceMobile, CreditCard, MagnifyingGlass, CheckCircle } from '@phosphor-icons/react'
import { CLUSTERS, DECA_EVENTS, examOf, type ClusterId } from '../data/events'
import type { PlayerRow } from '../store'

export function Avatar({ name, size = 32, inverse }: { name: string; size?: number; inverse?: boolean }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-soft font-bold ${inverse ? 'bg-white text-brand' : 'bg-brand text-white'}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

/** Full-width blue band with the DECA diamond pattern, like the page headers on deca.org. */
export function PageBand({ tag, title, description, actions, children }: { tag?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; children?: ReactNode }) {
  return (
    <section className="bleed diamond-pattern mb-10 bg-brand text-white">
      <div className="container-page py-10 sm:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            {tag && <span className="mb-4 inline-flex rounded-soft border-2 border-white px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-label">{tag}</span>}
            <h1 className="display text-4xl sm:text-5xl">{title}</h1>
            {description && <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-white/90">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
        {children}
      </div>
    </section>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 border-b border-line pb-3">
      <h2 className="h-section">{title}</h2>
      {action}
    </div>
  )
}

/** "Learn more" style link with the circled arrow DECA uses. */
export function ArrowLink({ to, children, inverse, onClick }: { to?: string; children: ReactNode; inverse?: boolean; onClick?: () => void }) {
  const cls = `group inline-flex items-center gap-2 text-[13px] font-semibold tracking-label ${inverse ? 'text-white' : 'text-brand hover:text-brand-hover'}`
  const inner = (
    <>
      {children}
      <ArrowCircleRight size={20} weight="fill" className="transition-transform group-hover:translate-x-0.5" />
    </>
  )
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button type="button" onClick={onClick} className={cls}>{inner}</button>
}

/** Underline tabs, as on deca.org/compete. */
export function Tabs<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex gap-8 overflow-x-auto border-b border-line">
      {options.map((o) => (
        <button
          key={o}
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={`-mb-px whitespace-nowrap border-b-2 pb-3 text-sm font-semibold transition-colors ${value === o ? 'border-brand text-brand' : 'border-transparent text-ink-3 hover:text-ink'}`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] font-bold uppercase tracking-label text-ink-3">{label}</span>
      <span className="num mt-1.5 text-3xl font-semibold tracking-head text-ink">{value}</span>
      {hint && <span className="mt-1 text-xs text-ink-3">{hint}</span>}
    </div>
  )
}

export function Meter({ value, color = '#0072CE' }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full bg-canvas">
      <div className="h-full" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}

export function EloChart({ data, height = 150 }: { data: number[]; height?: number }) {
  if (data.length < 2) {
    return (
      <div className="grid place-items-center bg-canvas text-center text-sm text-ink-3" style={{ height }}>
        Finish a couple of practice sessions to see your ELO trend.
      </div>
    )
  }
  const w = 600
  const min = Math.min(...data) - 10
  const max = Math.max(...data) + 10
  const x = (i: number) => (i / (data.length - 1)) * w
  const y = (v: number) => height - ((v - min) / (max - min || 1)) * height
  const path = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="ELO over time">
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1="0" x2={w} y1={height * f} y2={height * f} stroke="#E4E4E4" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={`${path} L${w},${height} L0,${height} Z`} fill="#EFF6FC" />
      <path d={path} fill="none" stroke="#0072CE" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function RankRow({ p, rank, trailing }: { p: PlayerRow; rank: number; trailing?: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${p.isMe ? 'bg-tint' : ''}`}>
      <span className={`num w-7 text-right text-sm font-semibold ${rank > 0 && rank <= 3 ? 'text-brand' : 'text-ink-3'}`}>{rank}</span>
      <Avatar name={p.name} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {p.name}
          {p.isMe && <span className="ml-1.5 text-xs font-medium text-ink-3">(you)</span>}
        </p>
        <p className="truncate text-xs text-ink-3">{p.school}</p>
      </div>
      {trailing ?? <span className="num text-sm font-semibold text-ink">{p.elo.toLocaleString()}</span>}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center rounded-soft bg-tint text-brand">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-[40ch] text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-11 shrink-0 rounded-soft border-2 transition-colors disabled:opacity-40 ${on ? 'border-brand bg-brand' : 'border-line-strong bg-white'}`}
    >
      <span className={`absolute left-0 top-0 h-5 w-5 rounded-soft transition-transform ${on ? 'translate-x-[18px] bg-white' : 'translate-x-0 bg-line-strong'}`} />
    </button>
  )
}

const CLUSTER_ICONS: Record<ClusterId, typeof Briefcase> = {
  bma: Briefcase,
  ent: Lightbulb,
  fin: CurrencyDollar,
  ht: Globe,
  mkt: DeviceMobile,
  pfl: CreditCard,
}
export const ClusterIcon = ({ id, size = 22 }: { id: ClusterId; size?: number }) => {
  const I = CLUSTER_ICONS[id]
  return <I size={size} />
}

// Each half of the marquee track holds this many copies of the six clusters
// (3 x 6 x 260px = 4680px), wider than any realistic screen, so the loop never
// shows a gap. The track scrolls exactly one half, then restarts seamlessly.
const MARQUEE_SETS = 3

/** Infinite scrolling strip of DECA's six career clusters (deca.org hero bar, animated). */
export function ClusterMarquee() {
  const tiles = Array.from({ length: MARQUEE_SETS * 2 }, () => CLUSTERS).flat()
  return (
    <div className="marquee bleed overflow-hidden" aria-label="DECA career clusters">
      <div className="marquee-track flex w-max">
        {tiles.map((c, i) => (
          <Link
            key={i}
            to={`/play?cluster=${c.id}`}
            aria-hidden={i >= CLUSTERS.length}
            tabIndex={i >= CLUSTERS.length ? -1 : 0}
            className="flex h-24 w-[260px] shrink-0 flex-col items-center justify-center gap-2.5 px-4 transition-[filter] hover:brightness-95"
            style={{ background: c.color, color: c.fg }}
          >
            <ClusterIcon id={c.id} size={24} />
            <span className="text-center text-[13px] font-semibold leading-tight">{c.short}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

/** Pick a DECA event. Events are grouped under the career cluster they belong to. */
export function EventPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [q, setQ] = useState('')
  const match = (s: string) => s.toLowerCase().includes(q.trim().toLowerCase())
  return (
    <div className="border border-line-strong">
      <label className="relative block border-b border-line">
        <span className="sr-only">Search events</span>
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
        <input className="h-11 w-full bg-white pl-9 pr-3 text-sm text-ink placeholder:text-ink-3 focus:outline-none" placeholder="Search events, e.g. Marketing or SEM" value={q} onChange={(e) => setQ(e.target.value)} />
      </label>
      <div className="max-h-[340px] overflow-y-auto">
        {CLUSTERS.map((c) => {
          const evs = DECA_EVENTS.filter((ev) => ev.cluster === c.id && (match(ev.name) || match(ev.code) || match(c.name)))
          if (!evs.length) return null
          return (
            <div key={c.id}>
              <p className="sticky top-0 z-[1] flex items-center gap-2 bg-canvas px-3 py-2 text-[11px] font-bold uppercase tracking-label text-ink">
                <span className="h-3 w-3" style={{ background: c.color }} aria-hidden />
                {c.name}
              </p>
              <ul>
                {evs.map((ev) => {
                  const on = value === ev.code
                  return (
                    <li key={ev.code}>
                      <button
                        type="button"
                        onClick={() => onChange(ev.code)}
                        className={`flex w-full items-center gap-3 border-l-4 px-3 py-2.5 text-left text-sm transition-colors ${on ? 'border-brand bg-tint' : 'border-transparent hover:bg-canvas'}`}
                      >
                        <span className="w-14 shrink-0 text-xs font-bold text-brand">{ev.code}</span>
                        <span className="min-w-0 flex-1">
                          <span className={`block ${on ? 'font-semibold text-ink' : 'text-ink-2'}`}>{ev.name}</span>
                          <span className="block text-xs text-ink-3">{examOf(ev.exam).name} exam</span>
                        </span>
                        {on && <CheckCircle size={18} weight="fill" className="shrink-0 text-brand" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
      </div>
    </div>
  )
}
