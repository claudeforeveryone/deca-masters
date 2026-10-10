import { useState } from 'react'
import { ChevronLeft, RotateCcw, Check } from 'lucide-react'
import { EVENTS, VOCAB, eventName, type EventId } from '../data/mock'
import { PageHeader } from '../components/ui'

export default function Vocab() {
  const [filter, setFilter] = useState<EventId | 'all'>('all')
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())
  const deck = VOCAB.filter((v) => filter === 'all' || v.event === filter)
  const card = deck[i % Math.max(deck.length, 1)]

  const go = (d: number) => {
    setFlipped(false)
    setI((i + d + deck.length) % deck.length)
  }

  return (
    <div>
      <PageHeader title="Vocab" subtitle="Flashcards for key DECA terms. Your trainers can also assign custom decks." />

      <div className="mb-6 flex flex-wrap gap-2">
        {[{ id: 'all', name: 'All' }, ...EVENTS].map((e) => (
          <button
            key={e.id}
            onClick={() => { setFilter(e.id as EventId | 'all'); setI(0); setFlipped(false) }}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ${filter === e.id ? 'bg-deca text-white' : 'bg-white text-navy shadow-card'}`}
          >
            {e.name}
          </button>
        ))}
      </div>

      {card ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <button
              onClick={() => setFlipped((f) => !f)}
              className={`grid h-72 w-full place-items-center rounded-3xl p-8 text-center shadow-card transition ${flipped ? 'bg-white' : 'bg-gradient-to-br from-navy to-deca text-white'}`}
            >
              <div>
                <span className={`chip ${flipped ? '' : 'bg-white/15 text-white'}`}>{eventName(card.event)}</span>
                <p className={`mt-4 ${flipped ? 'text-lg' : 'text-3xl font-extrabold'}`}>{flipped ? card.def : card.term}</p>
                <p className={`mt-6 text-xs ${flipped ? 'text-navy/40' : 'text-sky-200'}`}>Tap to flip</p>
              </div>
            </button>
            <div className="mt-4 flex items-center justify-between">
              <button className="btn-ghost" onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" /> Prev</button>
              <span className="muted">{(i % deck.length) + 1} / {deck.length}</span>
              <div className="flex gap-2">
                <button className="btn-ghost" onClick={() => { setKnown((k) => { const n = new Set(k); n.delete(card.term); return n }); go(1) }}>
                  <RotateCcw className="h-4 w-4" /> Still learning
                </button>
                <button className="btn-primary" onClick={() => { setKnown((k) => new Set(k).add(card.term)); go(1) }}>
                  <Check className="h-4 w-4" /> Got it
                </button>
              </div>
            </div>
          </div>
          <div className="card p-5">
            <h2 className="section-title">Deck progress</h2>
            <p className="muted">{known.size} of {VOCAB.length} mastered</p>
            <ul className="mt-4 space-y-2">
              {deck.map((v) => (
                <li key={v.term} className="flex items-center justify-between text-sm">
                  <span>{v.term}</span>
                  {known.has(v.term) ? <Check className="h-4 w-4 text-green-600" /> : <span className="h-2 w-2 rounded-full bg-sky-200" />}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p className="muted">No cards for this event yet.</p>
      )}
    </div>
  )
}
