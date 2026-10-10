import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ArrowsClockwise, CheckSquare, Square } from '@phosphor-icons/react'
import { EVENTS, VOCAB, eventName, eventOf, type EventId } from '../data/mock'
import { EmptyState, Meter, PageBand, SectionHeader } from '../components/ui'

type Filter = EventId | 'all'

export default function Vocab() {
  const [filter, setFilter] = useState<Filter>('all')
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())
  const deck = VOCAB.filter((v) => filter === 'all' || v.event === filter)
  const card = deck[i % Math.max(deck.length, 1)]

  const go = (d: number) => {
    setFlipped(false)
    setI((i + d + deck.length) % deck.length)
  }
  const mark = (got: boolean) => {
    setKnown((k) => {
      const n = new Set(k)
      if (got) n.add(card.term)
      else n.delete(card.term)
      return n
    })
    go(1)
  }

  return (
    <div>
      <PageBand tag="Study" title="Vocab" description="Flashcards for the terms that show up on cluster exams. Trainers can assign their own decks." />

      <div className="mb-8 flex flex-wrap gap-2">
        {[{ id: 'all', name: 'All terms', color: '#0072CE', fg: '#FFFFFF' }, ...EVENTS].map((e) => {
          const on = filter === e.id
          return (
            <button
              key={e.id}
              onClick={() => { setFilter(e.id as Filter); setI(0); setFlipped(false) }}
              className="border-2 px-3 py-1.5 text-[13px] font-semibold transition-colors"
              style={on ? { background: e.color, borderColor: e.color, color: e.fg } : { borderColor: '#E4E4E4', color: '#333333' }}
            >
              {e.name}
            </button>
          )
        })}
      </div>

      {!card ? (
        <div className="panel"><EmptyState icon={<ArrowsClockwise size={20} />} title="No cards for this event yet" body="Pick another event or ask your trainer to assign a deck." /></div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <button
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? 'Show term' : 'Show definition'}
              className={`flex min-h-[320px] w-full flex-col p-8 text-left sm:p-10 ${flipped ? 'border-2 border-brand bg-white' : 'diamond-pattern bg-brand text-white'}`}
            >
              <div className="flex w-full items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-label">
                  <span className="h-3 w-3" style={{ background: eventOf(card.event).color }} aria-hidden />
                  {eventName(card.event)}
                </span>
                <span className={`num text-sm ${flipped ? 'text-ink-3' : 'text-white/80'}`}>{(i % deck.length) + 1} / {deck.length}</span>
              </div>
              <div key={String(flipped) + card.term} className="enter flex flex-1 items-center py-8">
                {flipped ? (
                  <p className="max-w-[46ch] text-xl leading-relaxed text-ink">{card.def}</p>
                ) : (
                  <p className="display text-4xl sm:text-5xl">{card.term}</p>
                )}
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
            <SectionHeader title="Your progress" action={<span className="num text-sm font-semibold text-brand">{known.size}/{VOCAB.length}</span>} />
            <Meter value={(known.size / VOCAB.length) * 100} />
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
