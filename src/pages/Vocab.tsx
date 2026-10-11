import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, ArrowsClockwise, CheckSquare, Square, Plus, PencilSimple, Trash, X, UsersThree } from '@phosphor-icons/react'
import { EXAMS, examOf, type ExamId } from '../data/events'
import { useMyEvent, useStore, type Card, type DeckCard } from '../store'
import { EmptyState, Meter, PageBand, SectionHeader, Tabs, Toggle } from '../components/ui'

type Filter = ExamId | 'all' | 'custom'

export default function Vocab() {
  const { exam } = useMyEvent()
  const { deck: allCards, myAssignments, completeAssignment, me } = useStore()
  const [params] = useSearchParams()
  // Opened from an assignment: study just that set.
  const assignment = myAssignments.find((a) => a.id === params.get('assignment') && a.type === 'Flashcards')
  const assigned: DeckCard[] | null = assignment ? assignment.cards ?? allCards.filter((c) => c.exam === assignment.exam) : null

  const [filter, setFilter] = useState<Filter>(exam)
  const [i, setI] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const deck = assigned ?? allCards.filter((v) => filter === 'all' || (filter === 'custom' ? !!v.custom : v.exam === filter))
  const card = deck[i % Math.max(deck.length, 1)]
  const done = assignment && me ? assignment.results?.[me.id] : undefined

  // An assignment is finished once every card in it is marked "Got it".
  useEffect(() => {
    if (assignment && assigned && !done && assigned.length > 0 && assigned.every((c) => known.has(c.id))) completeAssignment(assignment.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [known])

  const go = (d: number) => {
    setFlipped(false)
    setI((i + d + deck.length) % deck.length)
  }
  const mark = (got: boolean) => {
    setKnown((k) => {
      const n = new Set(k)
      if (got) n.add(card.id)
      else n.delete(card.id)
      return n
    })
    go(1)
  }
  const chips = [
    { id: 'all' as Filter, name: 'All terms', color: '#0072CE', fg: '#FFFFFF' },
    ...EXAMS.map((x) => ({ ...x, id: x.id as Filter })),
    { id: 'custom' as Filter, name: 'Custom terms', color: '#002D6B', fg: '#FFFFFF' },
  ]
  const knownHere = deck.filter((c) => known.has(c.id)).length

  return (
    <div>
      {assignment ? (
        <PageBand
          tag="Assignment"
          title={assignment.title}
          description={`${deck.length} terms from ${assignment.by}. Mark every card "Got it" to finish.`}
          actions={<Link to="/play" className="btn-outline-white">All assignments</Link>}
        />
      ) : (
        <PageBand
          tag="Study"
          title="Vocab"
          description={`Flashcards for the terms that show up on cluster exams. Starting with the ${examOf(exam).name} exam.`}
          actions={<button className="btn-white" onClick={() => setAdding((a) => !a)}>{adding ? <><X size={16} /> Close</> : <><Plus size={16} /> Add terms</>}</button>}
        />
      )}

      {assignment && done && (
        <p className="mb-6 flex items-center gap-2 rounded-box border border-good/30 bg-good-bg px-4 py-3 text-sm font-semibold text-good"><Check size={16} /> Finished. Your trainer can see you completed this set.</p>
      )}

      {!assignment && adding && <AddTerms defaultExam={filter === 'all' || filter === 'custom' ? exam : filter} />}

      {!assignment && (
        <div className="mb-8 flex flex-wrap gap-2">
          {chips.map((e) => {
            const on = filter === e.id
            return (
              <button
                key={e.id}
                onClick={() => { setFilter(e.id); setI(0); setFlipped(false) }}
                className="rounded-soft border-2 px-3 py-1.5 text-[13px] font-semibold transition-colors"
                style={on ? { background: e.color, borderColor: e.color, color: e.fg } : { borderColor: '#E4E4E4', color: '#333333' }}
              >
                {e.name}
              </button>
            )
          })}
        </div>
      )}

      {!card ? (
        <div className="panel">
          <EmptyState
            icon={<ArrowsClockwise size={20} />}
            title={filter === 'custom' ? 'No custom terms yet' : 'No cards for this exam yet'}
            body={filter === 'custom' ? 'Add your own terms, or paste a whole list at once.' : 'Pick another exam, add your own terms or ask your trainer to assign a deck.'}
            action={!assignment && !adding ? <button className="btn-primary" onClick={() => setAdding(true)}><Plus size={16} /> Add terms</button> : undefined}
          />
        </div>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
          <div>
            <button
              onClick={() => setFlipped((f) => !f)}
              aria-label={flipped ? 'Show term' : 'Show definition'}
              className={`flex min-h-[320px] w-full flex-col rounded-box p-8 text-left sm:p-10 ${flipped ? 'border-2 border-brand bg-white' : 'diamond-pattern bg-brand text-white'}`}
            >
              <div className="flex w-full items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-label">
                  <span className="h-3 w-3" style={{ background: examOf(card.exam).color }} aria-hidden />
                  {examOf(card.exam).name}
                  {(card.custom || card.id.startsWith('cv-')) && <span className={`rounded-soft border px-1.5 py-0.5 text-[10px] ${flipped ? 'border-brand/30 text-brand' : 'border-white/60'}`}>Custom</span>}
                </span>
                <span className={`num text-sm ${flipped ? 'text-ink-3' : 'text-white/80'}`}>{(i % deck.length) + 1} / {deck.length}</span>
              </div>
              <div key={String(flipped) + card.id} className="enter flex flex-1 items-center py-8">
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
            <SectionHeader title="Your progress" action={<span className="num text-sm font-semibold text-brand">{knownHere}/{deck.length}</span>} />
            <Meter value={(knownHere / deck.length) * 100} />
            <ul className="mt-6 divide-y divide-line border-y border-line">
              {deck.map((v, k) => (
                <TermRow key={v.id} card={v} active={card.id === v.id} known={known.has(v.id)} editable={!assignment && v.custom?.authorId === me?.id} onPick={() => { setI(k); setFlipped(false) }} />
              ))}
            </ul>
          </aside>
        </div>
      )}
    </div>
  )
}

/** A row in the deck list. Your own custom terms can be edited or deleted in place. */
function TermRow({ card, active, known, editable, onPick }: { card: DeckCard; active: boolean; known: boolean; editable: boolean; onPick: () => void }) {
  const { editVocab, deleteVocab } = useStore()
  const [editing, setEditing] = useState(false)
  const [term, setTerm] = useState(card.term)
  const [def, setDef] = useState(card.def)
  const [exam, setExam] = useState<ExamId>(card.exam)

  const save = (e: FormEvent) => {
    e.preventDefault()
    if (!term.trim() || !def.trim()) return
    editVocab(card.id, { term: term.trim(), def: def.trim(), exam })
    setEditing(false)
  }

  if (editing)
    return (
      <li>
        <form className="space-y-2 bg-canvas px-2 py-3" onSubmit={save}>
          <input aria-label="Term" className="input h-9" value={term} onChange={(e) => setTerm(e.target.value)} autoFocus />
          <textarea aria-label="Definition" rows={2} className="input resize-none" value={def} onChange={(e) => setDef(e.target.value)} />
          <select aria-label="Exam" className="input h-9" value={exam} onChange={(e) => setExam(e.target.value as ExamId)}>{EXAMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
            <button className="btn-primary btn-sm">Save</button>
          </div>
        </form>
      </li>
    )

  return (
    <li className={`flex items-center ${active ? 'bg-tint' : 'hover:bg-canvas'}`}>
      <button onClick={onPick} className={`flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left text-sm ${active ? 'font-semibold text-brand' : 'text-ink-2'}`}>
        {known ? <CheckSquare size={18} weight="fill" className="shrink-0 text-brand" /> : <Square size={18} className="shrink-0 text-line-strong" />}
        <span className="truncate">{card.term}</span>
        {card.custom && (
          <span className="badge-neutral shrink-0 px-1.5 text-[10px]" title={card.custom.chapterId ? `Shared with your chapter by ${card.custom.author}` : 'Only you see this term'}>
            {card.custom.chapterId && <UsersThree size={11} />} Custom
          </span>
        )}
      </button>
      {editable && (
        <span className="flex shrink-0 pr-1">
          <button className="btn-ghost btn-sm h-7 w-7 px-0" aria-label={`Edit ${card.term}`} onClick={() => setEditing(true)}><PencilSimple size={14} /></button>
          <button className="btn-ghost btn-sm h-7 w-7 px-0 hover:bg-bad-bg hover:text-bad" aria-label={`Delete ${card.term}`} onClick={() => confirm(`Delete "${card.term}"?`) && deleteVocab(card.id)}><Trash size={14} /></button>
        </span>
      )}
    </li>
  )
}

/**
 * Splits one pasted line into a term and definition. A tab wins (spreadsheet columns); otherwise
 * whichever of " - " or ":" comes first; a bare dash is the last resort. Bullets and numbering are dropped.
 */
function parseLine(raw: string): Omit<Card, 'id' | 'exam'> | null {
  const line = raw.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim()
  const split = (m: RegExpMatchArray | null) => {
    if (!m || !m.index) return null
    const term = line.slice(0, m.index).trim()
    const def = line.slice(m.index + m[0].length).trim()
    return term && def ? { term, def } : null
  }
  const first = [line.match(/\s+[-–—]\s+/), line.match(/\s*:\s*/)].filter((m) => m?.index).sort((a, b) => a!.index! - b!.index!)[0] ?? null
  return split(line.match(/\t+/)) ?? split(first) ?? split(line.match(/\s*[-–—]\s*/))
}

const MODES = ['One at a time', 'Paste a list'] as const

function AddTerms({ defaultExam }: { defaultExam: ExamId }) {
  const { addVocab, myChapter } = useStore()
  const [mode, setMode] = useState<(typeof MODES)[number]>('One at a time')
  const [exam, setExam] = useState<ExamId>(defaultExam)
  const [share, setShare] = useState(false)
  const [term, setTerm] = useState('')
  const [def, setDef] = useState('')
  const [paste, setPaste] = useState('')
  const [added, setAdded] = useState('')
  const termRef = useRef<HTMLInputElement>(null)
  const defRef = useRef<HTMLInputElement>(null)

  const lines = paste.split('\n').filter((l) => l.trim())
  const parsed = lines.map((l) => ({ line: l, row: parseLine(l) }))
  const good = parsed.flatMap((p) => (p.row ? [p.row] : []))

  const addOne = (e?: FormEvent) => {
    e?.preventDefault()
    if (!term.trim() || !def.trim()) return
    addVocab([{ term: term.trim(), def: def.trim(), exam }], share)
    setAdded(`Added "${term.trim()}".`)
    setTerm('')
    setDef('')
    termRef.current?.focus() // stay open for the next term
  }
  // Enter in the term field jumps to the definition until both are filled in.
  const onTermKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !def.trim()) {
      e.preventDefault()
      defRef.current?.focus()
    }
  }
  const addAll = () => {
    if (!good.length) return
    addVocab(good.map((r) => ({ ...r, exam })), share)
    setAdded(`Added ${good.length} ${good.length === 1 ? 'term' : 'terms'}.`)
    setPaste('')
  }

  return (
    <section className="surface enter mb-8 p-5 sm:p-6">
      <Tabs options={MODES} value={mode} onChange={(m) => { setMode(m); setAdded('') }} />
      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div>
          <label className="field-label" htmlFor="add-exam">Exam</label>
          <select id="add-exam" className="input" value={exam} onChange={(e) => setExam(e.target.value as ExamId)}>{EXAMS.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </div>
        {myChapter && (
          <label className="flex h-10 items-center gap-3 text-sm text-ink-2">
            <Toggle on={share} onChange={setShare} label="Share with chapter" />
            Share with {myChapter.name}
          </label>
        )}
      </div>

      {mode === 'One at a time' ? (
        <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end" onSubmit={addOne}>
          <div>
            <label className="field-label" htmlFor="add-term">Term</label>
            <input id="add-term" ref={termRef} className="input" value={term} onChange={(e) => { setTerm(e.target.value); setAdded('') }} onKeyDown={onTermKey} autoFocus />
          </div>
          <div>
            <label className="field-label" htmlFor="add-def">Definition</label>
            <input id="add-def" ref={defRef} className="input" value={def} onChange={(e) => setDef(e.target.value)} />
          </div>
          <button className="btn-primary" disabled={!term.trim() || !def.trim()}><Plus size={16} /> Add</button>
        </form>
      ) : (
        <div className="mt-4">
          <label className="field-label" htmlFor="add-paste">One term per line</label>
          <textarea
            id="add-paste"
            rows={6}
            className="input resize-y font-mono text-[13px]"
            placeholder={'Liquidity - How quickly an asset turns into cash\nGross profit: Revenue minus cost of goods sold\nMarket share\tSales as a share of the industry'}
            value={paste}
            onChange={(e) => { setPaste(e.target.value); setAdded('') }}
          />
          <p className="mt-1.5 text-xs text-ink-3">Separate the term and definition with a dash, a colon or a tab (pasting two columns from a spreadsheet works).</p>
          {parsed.length > 0 && (
            <>
              <p className="mt-5 text-xs font-semibold text-ink">Preview: {good.length} of {parsed.length} lines will be added</p>
              <ul className="mt-2 max-h-64 divide-y divide-line overflow-y-auto border border-line text-sm">
                {parsed.map((p, k) => (
                  <li key={k} className="flex gap-3 px-3 py-2">
                    {p.row ? (
                      <>
                        <span className="w-1/3 shrink-0 font-semibold text-ink">{p.row.term}</span>
                        <span className="min-w-0 flex-1 text-ink-2">{p.row.def}</span>
                      </>
                    ) : (
                      <span className="text-bad">Skipped, no definition found: <span className="text-ink-3">{p.line}</span></span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="mt-4 flex justify-end">
            <button className="btn-primary" disabled={!good.length} onClick={addAll}><Plus size={16} /> Add {good.length || ''} {good.length === 1 ? 'term' : 'terms'}</button>
          </div>
        </div>
      )}
      {added && <p role="status" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-good"><Check size={15} /> {added}</p>}
    </section>
  )
}
