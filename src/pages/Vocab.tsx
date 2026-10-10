import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ArrowsClockwise, CheckCircle, Circle } from '@phosphor-icons/react'
import { EVENTS, VOCAB, eventName, type EventId } from '../data/mock'
import { EmptyState, Meter, PageHeader } from '../components/ui'

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
      <PageHeader title="Vocab" description="Flashcards for the terms that show up on cluster exams. Trainers can assign their own decks." />

      <div className="mb-6 flex gap-1.5 overflow-x-auto pb-1">
        {[{ id: 'all', name: 'All terms' }, ...EVENTS].map((e) => (
          <button
            key={e.id}
            onClick={() => { setFilter(e.id as Filter); setI(0); setFlipped(false) }}
            className={`whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === e.id ? 'border-brand bg-tint text-brand' : 'border-line bg-white text-ink-2 hover:border-line-strong'
            }`}
          >
            {e.name}
          </button>
        ))}
      </div>

      {!card ? (
        <div className="surface"><EmptyState icon={<ArrowsClockwise size={18} />} title="No cards for this event yet" body="Pick another event or ask your trainer to assign a deck." /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          <div>
            <button
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? 'Show term' : 'Show definition'}
              className={`flex min-h-[300px] w-full flex-col rounded-xl border p-8 text-left transition-colors ${flipped ? 'border-brand/30 bg-tint' : 'border-line bg-white hover:border-line-strong'}`}
            >
              <div className="flex w-full items-center justify-between text-[13px] text-ink-3">
                <span>{eventName(card.event)}</span>
                <span className="num">{(i % deck.length) + 1} / {deck.length}</span>
              </div>
              <div key={String(flipped) + card.term} className="enter flex flex-1 items-center">
                {flipped ? (
                  <p className="max-w-[48ch] text-lg leading-relaxed text-ink">{card.def}</p>
                ) : (
                  <p className="text-3xl font-semibold sm:text-4xl">{card.term}</p>
                )}
              </div>
              <span className="text-[13px] text-ink-3">{flipped ? 'Definition' : 'Click to reveal the definition'}</span>
            </button>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-1">
                <button className="btn-secondary w-9 px-0" onClick={() => go(-1)} aria-label="Previous"><ArrowLeft size={16} /></button>
                <button className="btn-secondary w-9 px-0" onClick={() => go(1)} aria-label="Next"><ArrowRight size={16} /></button>
              </div>
              <div className="flex gap-2">
                <button className="btn-secondary" onClick={() => mark(false)}><ArrowsClockwise size={16} /> Still learning</button>
                <button className="btn-primary" onClick={() => mark(true)}><Check size={16} /> Got it</button>
              </div>
            </div>
          </div>

          <aside className="surface h-fit p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="h-section">Progress</h2>
              <span className="num text-sm text-ink-3">{known.size}/{VOCAB.length}</span>
            </div>
            <div className="mt-3"><Meter value={(known.size / VOCAB.length) * 100} /></div>
            <ul className="mt-5 space-y-2.5">
              {deck.map((v, k) => (
                <li key={v.term}>
                  <button onClick={() => { setI(k); setFlipped(false) }} className={`flex w-full items-center gap-2.5 text-left text-sm ${card.term === v.term ? 'font-medium text-ink' : 'text-ink-2 hover:text-ink'}`}>
                    {known.has(v.term) ? <CheckCircle size={16} weight="fill" className="text-brand" /> : <Circle size={16} className="text-line-strong" />}
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
