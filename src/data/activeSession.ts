import type { ExamId } from './events'

// The quiz in progress is saved to localStorage after every answer. Leaving the page,
// clicking a nav link or reloading resumes the same questions with the clock still
// running, so a bad session cannot be dodged or re-rolled.
export type ActiveSession = {
  kind: 'play' | 'arena'
  title: string
  exam: ExamId
  questionIds: string[]
  answers: (number | null)[]
  startedAt: number
  timeLimitSec?: number
  explanations: boolean
  unranked?: boolean
  opponentId?: string
  /** A chapter assignment: the score is saved to it at the end. */
  assignmentId?: string
}

const key = (userId: string, kind: ActiveSession['kind']) => `deca-masters:active:${kind}:${userId}`

export function loadActive(userId: string, kind: ActiveSession['kind']): ActiveSession | null {
  try {
    const raw = localStorage.getItem(key(userId, kind))
    return raw ? (JSON.parse(raw) as ActiveSession) : null
  } catch {
    return null
  }
}

export function saveActive(userId: string, s: ActiveSession) {
  try {
    localStorage.setItem(key(userId, s.kind), JSON.stringify(s))
  } catch {
    /* storage unavailable: the session just won't survive a reload */
  }
}

export function clearActive(userId: string, kind: ActiveSession['kind']) {
  try {
    localStorage.removeItem(key(userId, kind))
  } catch {
    /* ignore */
  }
}
