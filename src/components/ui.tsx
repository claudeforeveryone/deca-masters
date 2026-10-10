import type { ReactNode } from 'react'
import type { Player } from '../data/mock'

export function StatCard({ label, value, sub, icon }: { label: string; value: ReactNode; sub?: string; icon?: ReactNode }) {
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-navy/50">{label}</span>
        {icon && <span className="text-deca">{icon}</span>}
      </div>
      <div className="mt-1 text-2xl font-extrabold text-navy">{value}</div>
      {sub && <div className="text-xs text-navy/50">{sub}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl bg-sky-100 p-1">
      {tabs.map((t) => (
        <button key={t} onClick={() => onChange(t)} className={`tab ${value === t ? 'tab-active' : ''}`}>
          {t}
        </button>
      ))}
    </div>
  )
}

export function Bar({ value, color = '#0072CE' }: { value: number; color?: string }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-sky-100">
      <div className="h-full rounded-full" style={{ width: `${value}%`, background: color }} />
    </div>
  )
}

export function Sparkline({ data, className = '' }: { data: number[]; className?: string }) {
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${40 - ((v - min) / (max - min || 1)) * 36 - 2}`)
    .join(' ')
  return (
    <svg viewBox="0 0 100 40" preserveAspectRatio="none" className={className}>
      <polyline points={`0,40 ${pts} 100,40`} fill="#C5E3FB" opacity=".6" />
      <polyline points={pts} fill="none" stroke="#0072CE" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function PlayerRow({ p, rank, highlight, right }: { p: Player; rank: number; highlight?: boolean; right?: ReactNode }) {
  const medal = rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-slate-300' : rank === 3 ? 'bg-amber-600' : 'bg-sky-100'
  return (
    <div className={`flex items-center gap-3 rounded-xl px-3 py-2 ${highlight ? 'bg-sky-100 ring-1 ring-deca/30' : ''}`}>
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${rank <= 3 ? 'text-white' : 'text-navy'} ${medal}`}>
        {rank}
      </span>
      <img src={p.avatar} alt="" className="h-8 w-8 rounded-full" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{p.name}</div>
        <div className="truncate text-xs text-navy/50">{p.chapter}</div>
      </div>
      {right ?? <span className="text-sm font-bold text-deca">{p.elo}</span>}
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold text-navy sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-navy/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
