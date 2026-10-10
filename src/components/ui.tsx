import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowCircleRight, Briefcase, Lightbulb, CurrencyDollar, Globe, DeviceMobile, BookOpenText } from '@phosphor-icons/react'
import { EVENTS, type EventId, type Player } from '../data/mock'

export function Avatar({ name, size = 32, inverse }: { name: string; size?: number; inverse?: boolean }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  return (
    <span
      className={`inline-grid shrink-0 place-items-center font-bold ${inverse ? 'bg-white text-brand' : 'bg-brand text-white'}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

/** Full-width blue band with the DECA diamond pattern, like the page headers on deca.org. */
export function PageBand({ tag, title, description, actions, tone = 'blue', children }: { tag?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode; tone?: 'blue' | 'navy'; children?: ReactNode }) {
  return (
    <section className={`bleed diamond-pattern mb-10 text-white ${tone === 'blue' ? 'bg-brand' : 'bg-navy-midnight'}`}>
      <div className="container-page py-10 sm:py-14">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            {tag && <span className="mb-4 inline-flex border-2 border-white px-2 py-1 text-[10px] font-bold uppercase leading-none tracking-label">{tag}</span>}
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
  return to ? <Link to={to} className={cls}>{inner}</Link> : <button onClick={onClick} className={cls}>{inner}</button>
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
      <div className="h-full" style={{ width: `${Math.max(2, Math.min(100, value))}%`, background: color }} />
    </div>
  )
}

export function EloChart({ data, height = 150 }: { data: number[]; height?: number }) {
  const w = 600
  const min = Math.min(...data) - 20
  const max = Math.max(...data) + 20
  const x = (i: number) => (i / (data.length - 1)) * w
  const y = (v: number) => height - ((v - min) / (max - min)) * height
  const path = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const gridVals = [0.25, 0.5, 0.75].map((f) => min + (max - min) * f)
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="ELO over time">
      {gridVals.map((g) => (
        <line key={g} x1="0" x2={w} y1={y(g)} y2={y(g)} stroke="#E4E4E4" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={`${path} L${w},${height} L0,${height} Z`} fill="#EFF6FC" />
      <path d={path} fill="none" stroke="#0072CE" strokeWidth="2.5" strokeLinejoin="miter" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function RankRow({ p, rank, me, trailing }: { p: Player; rank: number; me?: boolean; trailing?: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${me ? 'bg-tint' : ''}`}>
      <span className={`num w-6 text-right text-sm font-semibold ${rank <= 3 ? 'text-brand' : 'text-ink-3'}`}>{rank}</span>
      <Avatar name={p.name} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {p.name}
          {me && <span className="ml-1.5 text-xs font-medium text-ink-3">(you)</span>}
        </p>
        <p className="truncate text-xs text-ink-3">{p.chapter}</p>
      </div>
      {trailing ?? <span className="num text-sm font-semibold text-ink">{p.elo.toLocaleString()}</span>}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-11 w-11 place-items-center bg-tint text-brand">{icon}</span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-[36ch] text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
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
      className={`relative h-6 w-11 shrink-0 border-2 transition-colors disabled:opacity-40 ${on ? 'border-brand bg-brand' : 'border-line-strong bg-white'}`}
    >
      <span className={`absolute left-0 top-0 h-5 w-5 transition-transform ${on ? 'translate-x-[18px] bg-white' : 'translate-x-0 bg-line-strong'}`} />
    </button>
  )
}

const EVENT_ICONS: Record<EventId, typeof Briefcase> = {
  management: Briefcase,
  entrepreneurship: Lightbulb,
  finance: CurrencyDollar,
  hospitality: Globe,
  marketing: DeviceMobile,
  core: BookOpenText,
}
export const EventIcon = ({ id, size = 22 }: { id: EventId; size?: number }) => {
  const I = EVENT_ICONS[id]
  return <I size={size} />
}

/** Career cluster colour strip, as under the deca.org hero. */
export function ClusterBar({ onSelect, active, bleed }: { onSelect?: (id: EventId) => void; active?: EventId; bleed?: boolean }) {
  return (
    <div className={`grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 ${bleed ? 'bleed' : ''}`}>
      {EVENTS.map((e) => {
        const on = active === e.id
        const content = (
          <>
            <EventIcon id={e.id} size={24} />
            <span className="text-center text-[13px] font-semibold leading-tight">{e.name}</span>
          </>
        )
        const cls = `flex min-h-[96px] flex-col items-center justify-center gap-2.5 px-3 py-4 transition-opacity hover:brightness-95 ${on ? 'shadow-[inset_0_-6px_0_rgba(255,255,255,.95)]' : ''}`
        const style = { background: e.color, color: e.fg }
        return onSelect ? (
          <button key={e.id} onClick={() => onSelect(e.id)} className={cls} style={style} aria-pressed={active === e.id}>{content}</button>
        ) : (
          <Link key={e.id} to={`/play?event=${e.id}`} className={cls} style={style}>{content}</Link>
        )
      })}
    </div>
  )
}
