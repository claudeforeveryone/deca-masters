import { Link } from 'react-router-dom'
import { CalendarBlank, CheckCircle, ClipboardText } from '@phosphor-icons/react'
import { examOf } from '../data/events'
import { useStore, type Assignment } from '../store'
import { EmptyState } from './ui'

export const fmtDue = (d: string) => new Date(d + 'T12:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
export const isOverdue = (d: string) => !!d && d < new Date().toISOString().slice(0, 10)
export const assignmentKind = (a: Assignment) =>
  a.type === 'Flashcards' ? `Vocab, ${a.cards?.length ?? 'all'} terms` : `${a.type === 'Test' ? 'Test' : 'Shuffled exam'}, ${a.count ?? a.questionIds?.length ?? 20} questions`
/** Where a member goes to do an assignment: flashcards on Vocab, tests on Play. */
export const assignmentLink = (a: Assignment) => (a.type === 'Flashcards' ? `/vocab?assignment=${a.id}` : `/play?assignment=${a.id}`)

/** The current member's assignments: open work first (soonest due on top), finished work after. */
export default function AssignedToYou() {
  const { me, myChapter, myAssignments } = useStore()
  const open = myAssignments.filter((a) => !a.results?.[me!.id]).sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999'))
  const done = myAssignments.filter((a) => a.results?.[me!.id])

  if (!myAssignments.length)
    return (
      <div className="panel">
        <EmptyState
          icon={<ClipboardText size={20} />}
          title="Nothing assigned yet"
          body={myChapter ? 'When a trainer in your chapter assigns a test or vocab set, it shows up here.' : 'Join your chapter to get tests and vocab sets from your trainers.'}
          action={myChapter ? undefined : <Link to="/chapter" className="btn-secondary">Join a chapter</Link>}
        />
      </div>
    )

  return (
    <ul className="divide-y divide-line border border-line">
      {[...open, ...done].map((a) => {
        const r = a.results?.[me!.id]
        const late = !r && isOverdue(a.due)
        return (
          <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
            <span className="h-8 w-1.5 shrink-0" style={{ background: examOf(a.exam).color }} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">{a.title}</p>
              <p className="text-xs text-ink-3">{assignmentKind(a)}, {examOf(a.exam).name}, from {a.by}</p>
            </div>
            {a.due && (
              <span className={`inline-flex items-center gap-1 text-xs ${late ? 'font-semibold text-bad' : 'text-ink-2'}`}>
                <CalendarBlank size={14} /> {late ? 'Overdue, ' : 'Due '}{fmtDue(a.due)}
              </span>
            )}
            {r ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-good">
                <CheckCircle size={16} weight="fill" /> {r.total ? `${Math.round(((r.correct ?? 0) / r.total) * 100)}% (${r.correct}/${r.total})` : 'Done'}
              </span>
            ) : (
              <Link to={assignmentLink(a)} className="btn-primary btn-sm">{a.type === 'Flashcards' ? 'Study' : 'Start'}</Link>
            )}
          </li>
        )
      })}
    </ul>
  )
}
