import type { ReactNode } from 'react'
import type { Player } from '../data/mock'

export function Avatar({ name, size = 32, ring }: { name: string; size?: number; ring?: boolean }) {
  const initials = name.split(' ').map((w) => w[0]).slice(0, 2).join('')
  return (
    <span
      className={`inline-grid shrink-0 place-items-center rounded-full bg-tint-2 font-semibold text-brand-press ${ring ? 'ring-2 ring-white' : ''}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
      aria-hidden
    >
      {initials}
    </span>
  )
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold sm:text-[28px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-[60ch] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Segmented<T extends string>({ options, value, onChange, size = 'md' }: { options: readonly T[]; value: T; onChange: (v: T) => void; size?: 'sm' | 'md' }) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto rounded-lg border border-line bg-white p-0.5">
      {options.map((o) => (
        <button
          key={o}
          role="tab"
          aria-selected={value === o}
          onClick={() => onChange(o)}
          className={`whitespace-nowrap rounded-md font-medium transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-[13px]' : 'px-3.5 py-1.5 text-sm'} ${
            value === o ? 'bg-tint text-brand' : 'text-ink-3 hover:text-ink'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  )
}

export function Stat({ label, value, hint, icon }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5 text-[13px] text-ink-3">
        {icon}
        {label}
      </span>
      <span className="num text-2xl font-semibold text-ink">{value}</span>
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </div>
  )
}

/** Thin meter, no heavy track. */
export function Meter({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'bad' }) {
  return (
    <div className="h-1.5 w-full rounded-full bg-line/70">
      <div className={`h-full rounded-full ${tone === 'bad' ? 'bg-bad' : 'bg-brand'}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  )
}

export function EloChart({ data, height = 140 }: { data: number[]; height?: number }) {
  const w = 600
  const min = Math.min(...data) - 20
  const max = Math.max(...data) + 20
  const x = (i: number) => (i / (data.length - 1)) * w
  const y = (v: number) => height - ((v - min) / (max - min)) * height
  const path = data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const gridVals = [min + (max - min) * 0.25, min + (max - min) * 0.5, min + (max - min) * 0.75]
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label="ELO over time">
      {gridVals.map((g) => (
        <line key={g} x1="0" x2={w} y1={y(g)} y2={y(g)} stroke="#E3E8EF" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      ))}
      <path d={`${path} L${w},${height} L0,${height} Z`} fill="#EBF4FD" />
      <path d={path} fill="none" stroke="#0B6FCB" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function RankRow({ p, rank, me, trailing }: { p: Player; rank: number; me?: boolean; trailing?: ReactNode }) {
  return (
    <div className={`flex items-center gap-3 rounded-lg px-3 py-2.5 ${me ? 'bg-tint' : ''}`}>
      <span className={`num w-6 text-right text-sm ${rank <= 3 ? 'font-semibold text-brand' : 'text-ink-3'}`}>{rank}</span>
      <Avatar name={p.name} size={30} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {p.name}
          {me && <span className="ml-1.5 text-xs font-normal text-ink-3">(you)</span>}
        </p>
        <p className="truncate text-xs text-ink-3">{p.chapter}</p>
      </div>
      {trailing ?? <span className="num text-sm font-medium">{p.elo.toLocaleString()}</span>}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-tint text-brand">{icon}</span>
      <p className="mt-3 text-sm font-medium">{title}</p>
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
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-50 ${on ? 'bg-brand' : 'bg-line-strong'}`}
    >
      <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  )
}
