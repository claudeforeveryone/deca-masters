import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ArrowsClockwise, CheckSquare, Square } from '@phosphor-icons/react'
import { EXAMS, examOf, type ExamId } from '../data/events'
import { VOCAB } from '../data/questions'
import { useMyEvent, useStore } from '../store'
import { cue } from '../sound'
import { EmptyState, Meter, PageBand, SectionHeader } from '../components/ui'

type Filter = ExamId | 'all'

// Terms marked "Got it", saved per user so they survive a reload.
const knownKey = (userId: string) => `deca-masters:vocab:${userId}`
function loadKnown(userId: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(knownKey(userId)) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

export default function Vocab() {
  const { me } = useStore()
  const { exam } = useMyEvent()
  const [filter, setFilter] = useState<Filter>(exam)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnownState] = useState(() => loadKnown(me!.id))
  const deck = VOCAB.filter((v) => filter === 'all' || v.exam === filter)
  const card = deck[i % Math.max(deck.length, 1)]
  // Progress counts the section you are looking at, so one exam reads 1/2, not 1/14.
  const knownHere = deck.filter((v) => known.has(v.term)).length
  const section = filter === 'all' ? 'All terms' : examOf(filter).name

  const go = (d: number) => {
    setFlipped(false)
    setI((i + d + deck.length) % deck.length)
  }
  const mark = (got: boolean) => {
    const n = new Set(known)
    if (got) n.add(card.term)
    else n.delete(card.term)
    setKnownState(n)
    try {
      localStorage.setItem(knownKey(me!.id), JSON.stringify([...n]))
    } catch {
      /* storage unavailable: progress lasts until reload */
    }
    if (got) cue('known')
    go(1)
  }
  const flip = () => {
    cue('flip')
    setFlipped((f) => !f)
  }
  const chips = [{ id: 'all' as Filter, name: 'All terms', color: '#0072CE', fg: '#FFFFFF' }, ...EXAMS.map((x) => ({ ...x, id: x.id as Filter }))]

  return (
    <div>
      <PageBand tag="Study" title="Vocab" description={`Flashcards for the terms that show up on cluster exams. Starting with the ${examOf(exam).name} exam.`} />

      <div className="mb-8 flex flex-wrap gap-2">
        {chips.map((e) => {
          const on = filter === e.id
          return (
            <button
              key={e.id}
              onClick={() => { setFilter(e.id); setI(0); setFlipped(false) }}
              className={`rounded-soft border-2 px-3 py-1.5 text-[13px] font-semibold transition-colors ${on ? '' : 'border-line text-ink-2 hover:border-line-strong'}`}
              style={on ? { background: e.color, borderColor: e.color, color: e.fg } : undefined}
            >
              {e.name}
              <span className="num ml-1.5 opacity-75">{e.id === 'all' ? VOCAB.length : VOCAB.filter((v) => v.exam === e.id).length}</span>
            </button>
          )
        })}
      </div>

      {!card ? (
        <div className="panel"><EmptyState icon={<ArrowsClockwise size={20} />} title="No cards for this exam yet" body="Pick another exam or ask your trainer to assign a deck." /></div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <button
              onClick={flip}
              aria-label={flipped ? 'Show term' : 'Show definition'}
              className={`flex min-h-[320px] w-full flex-col rounded-box p-8 text-left sm:p-10 ${flipped ? 'border-2 border-brand bg-white' : 'diamond-pattern bg-brand text-white'}`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-label">
                  <span className="h-3 w-3" style={{ background: examOf(card.exam).color }} aria-hidden />
                  {examOf(card.exam).name}
                </span>
                <span className={`num text-sm ${flipped ? 'text-ink-3' : 'text-white/80'}`}>{(i % deck.length) + 1} / {deck.length}</span>
              </div>
              <div key={String(flipped) + card.term} className="enter flex flex-1 items-center py-8">
                {flipped ? <p className="max-w-[46ch] text-xl leading-relaxed text-ink">{card.def}</p> : <p className="display text-4xl sm:text-5xl">{card.term}</p>}
              </div>
              <span className={`text-[13px] font-semibold ${flipped ? 'text-brand' : 'text-white/85'}`}>{flipped ? 'Definition' : 'Click the card to see the definition'}</span>
            </button>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-2">
                <button className="btn-ghost w-10 border-line px-0" onClick={() => go(-1)} aria-label="Previous"><ArrowLeft size={18} /></button>
                <button className="btn-ghost w-10 border-line px-0" onClick={() => go(1)} aria-label="Next"><ArrowRight size={18} /></button>
              </div>
              <div className="flex gap-3">
                <button className="btn-secondary" onClick={() => mark(false)}><ArrowsClockwise size={16} /> Still learning</button>
                <button className="btn-primary" onClick={() => mark(true)}><Check size={16} /> Got it</button>
              </div>
            </div>
          </div>

          <aside>
            <SectionHeader title="Your progress" action={<span className="num text-sm font-semibold text-brand" aria-label={`${knownHere} of ${deck.length} known`}>{knownHere}/{deck.length}</span>} />
            <Meter value={(knownHere / deck.length) * 100} />
            <p className="mt-2 text-xs text-ink-3">
              <span className="font-semibold text-ink-2">{section}</span>: {knownHere} of {deck.length} {deck.length === 1 ? 'term' : 'terms'} known
              {filter !== 'all' && `, ${known.size} of ${VOCAB.length} across all exams`}
            </p>
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {deck.map((v, k) => (
                <li key={v.term}>
                  <button
                    onClick={() => { setI(k); setFlipped(false) }}
                    className={`flex w-full items-center gap-3 px-2 py-3 text-left text-sm ${card.term === v.term ? 'bg-tint font-semibold text-brand' : 'text-ink-2 hover:bg-canvas'}`}
                  >
                    {known.has(v.term) ? <CheckSquare size={18} weight="fill" className="text-brand" /> : <Square size={18} className="text-line-strong" />}
                    {v.term}
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  )
}
