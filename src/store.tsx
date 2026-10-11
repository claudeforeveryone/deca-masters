// App state: session (guest or account), local accounts, progress and chapters.
// Everything is saved to localStorage, so it only lives in this browser until a
// real backend (auth + database) replaces it.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CLUSTERS, eventByCode, type ClusterId, type ExamId } from './data/events'
import { DEMO_CHAPTERS, DEMO_PLAYERS, makeChapterCode } from './data/demo'
import { VOCAB } from './data/questions'

export type Role = 'President' | 'Executive' | 'Trainer' | 'Member'

export type Attempt = {
  id: string
  title: string
  exam: ExamId
  date: string // ISO
  total: number
  correct: number
  seconds: number
  eloDelta: number
  wrongIds: string[]
  arena?: { opponent: string; won: boolean }
  /** Practice on questions you have already seen (retries, redos, bank quizzes, a repeat daily). No ELO or accuracy change. */
  unranked?: boolean
}

export type Progress = {
  elo: number
  answered: number
  correct: number
  seconds: number
  streak: number
  bestStreak: number
  lastDay: string | null
  byExam: Partial<Record<ExamId, { answered: number; correct: number }>>
  history: Attempt[]
  arena: { w: number; l: number }
}

export type Account = {
  id: string
  email: string
  passHash: string
  name: string
  school: string
  grade: number
  eventCode: string
  chapterId: string | null
  progress: Progress
  createdAt: string
}

export type Post = { id: string; type: 'Announcement' | 'Link' | 'Newsletter'; authorId: string; author: string; role: string; title: string; body: string; url?: string; date: string }
/** A flashcard: a built-in term (id "v-...") or one a user added (id "cv-..."). */
export type Card = { id: string; term: string; def: string; exam: ExamId }
/** A term a user added. Personal unless chapterId is set, then every member of that chapter sees it. */
export type VocabTerm = Card & { authorId: string; author: string; chapterId: string | null; created: string }
export type DeckCard = Card & { custom?: VocabTerm }

export type AssignmentResult = { date: string; correct?: number; total?: number }
export type Assignment = {
  id: string
  title: string
  /** Test: the same drawn questions for everyone. Shuffled exam: a fresh draw per member. Flashcards: a vocab set. */
  type: 'Test' | 'Flashcards' | 'Shuffled exam'
  exam: ExamId
  due: string // YYYY-MM-DD, or '' for no due date
  by: string
  byId?: string
  /** Member ids. Missing means the whole chapter. */
  assignees?: string[]
  /** Test and Shuffled exam: number of questions. */
  count?: number
  /** Test: the question ids everyone gets, plus any prompt rewrites from the test builder. */
  questionIds?: string[]
  edits?: Record<string, string>
  /** Flashcards: a copy of the terms, so later edits or deletes of a custom term do not break the set. */
  cards?: Card[]
  /** member id -> when they finished, and their score for tests. */
  results?: Record<string, AssignmentResult>
}
export type ChapterMeta = {
  roles: Record<string, Role>
  posts: Post[]
  trainers: Partial<Record<ClusterId, string[]>>
  digest: boolean
  nudge: boolean
  removed: string[]
  banned: string[]
  attendance: Record<string, string[]> // meeting date -> member ids present
  assignments: Assignment[]
}
export type LocalChapter = { id: string; name: string; school: string; code: string; createdBy: string }

type Session = { kind: 'guest'; eventCode: string } | { kind: 'user'; userId: string } | null

type Persisted = {
  session: Session
  accounts: Account[]
  guest: Progress
  chapters: LocalChapter[]
  meta: Record<string, ChapterMeta>
  vocab: VocabTerm[]
}

/** A row in any leaderboard: a demo account or a real local account. */
export type PlayerRow = {
  id: string
  name: string
  school: string
  grade: number
  eventCode: string
  elo: number
  questions: number
  accuracy: number
  chapterId: string | null
  online: boolean
  lastActiveDays: number
  isMe: boolean
  isDemo: boolean
}

export type ChapterRow = { id: string; name: string; school: string; code: string; members: PlayerRow[]; totalElo: number; isDemo: boolean }

export const emptyProgress = (): Progress => ({ elo: 0, answered: 0, correct: 0, seconds: 0, streak: 0, bestStreak: 0, lastDay: null, byExam: {}, history: [], arena: { w: 0, l: 0 } })
const emptyMeta = (): ChapterMeta => ({ roles: {}, posts: [], trainers: {}, digest: true, nudge: true, removed: [], banned: [], attendance: {}, assignments: [] })

const slug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const BUILT_IN_DECK: DeckCard[] = VOCAB.map((v) => ({ ...v, id: `v-${v.exam}-${slug(v.term)}` }))

/** The assignment is for this member: the whole chapter, or they were picked. */
export const isAssignedTo = (a: Assignment, userId: string) => !a.assignees || a.assignees.includes(userId)

/** Officers (President, Executive), members given the Trainer role, and cluster trainers can assign work. */
export const canAssign = (meta: ChapterMeta, userId: string) =>
  (meta.roles[userId] ?? 'Member') !== 'Member' || Object.values(meta.trainers).some((ids) => ids?.includes(userId))

const KEY = 'deca-masters:v1'
const load = (): Persisted => {
  const fresh: Persisted = { session: null, accounts: [], guest: emptyProgress(), chapters: [], meta: {}, vocab: [] }
  try {
    const raw = localStorage.getItem(KEY)
    // Older saves have no vocab list, so fill in anything missing.
    if (raw) return { ...fresh, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable: start fresh */
  }
  return fresh
}

async function hash(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const uid = () => Math.random().toString(36).slice(2, 10)
const dayKey = (d = new Date()) => d.toISOString().slice(0, 10)

/** ELO change for a session: +8 per correct answer, -4 per miss. */
export const eloDelta = (correct: number, total: number, perCorrect = 8) => correct * perCorrect - (total - correct) * Math.round(perCorrect / 2)

type RegisterInput = { email: string; password: string; name: string; school: string; grade: number; eventCode: string; chapterCode?: string }

type Store = {
  ready: boolean
  isGuest: boolean
  signedIn: boolean
  me: { id: string; name: string; school: string; grade: number; eventCode: string; chapterId: string | null; progress: Progress } | null
  players: PlayerRow[]
  chapters: ChapterRow[]
  myChapter: ChapterRow | null
  myRank: number
  /** Built-in terms, your own terms and terms shared to your chapter. */
  deck: DeckCard[]
  /** Assignments in your chapter that are for you. */
  myAssignments: Assignment[]
  chapterMeta: (id: string) => ChapterMeta
  startGuest: (eventCode: string) => void
  register: (input: RegisterInput) => Promise<string | null>
  login: (email: string, password: string) => Promise<string | null>
  logout: () => void
  setEvent: (code: string) => void
  record: (a: Omit<Attempt, 'id' | 'date' | 'eloDelta'>, perCorrect?: number) => number
  createChapter: (name: string, school: string) => void
  joinChapter: (code: string) => string | null
  leaveChapter: () => void
  updateMeta: (chapterId: string, fn: (m: ChapterMeta) => ChapterMeta) => void
  addVocab: (terms: Omit<Card, 'id'>[], share: boolean) => void
  editVocab: (id: string, patch: Partial<Pick<VocabTerm, 'term' | 'def' | 'exam' | 'chapterId'>>) => void
  deleteVocab: (id: string) => void
  /** Marks one of your assignments finished, with the score for tests. */
  completeAssignment: (id: string, r?: { correct: number; total: number }) => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state))
    } catch {
      /* ignore quota / private mode */
    }
  }, [state])

  const account = state.session?.kind === 'user' ? state.accounts.find((a) => a.id === (state.session as { userId: string }).userId) ?? null : null
  const isGuest = state.session?.kind === 'guest'

  const me: Store['me'] = account
    ? { id: account.id, name: account.name, school: account.school, grade: account.grade, eventCode: account.eventCode, chapterId: account.chapterId, progress: account.progress }
    : isGuest
      ? { id: 'guest', name: 'Guest', school: '', grade: 0, eventCode: (state.session as { eventCode: string }).eventCode, chapterId: null, progress: state.guest }
      : null

  const players = useMemo<PlayerRow[]>(() => {
    const real: PlayerRow[] = state.accounts.map((a) => ({
      id: a.id,
      name: a.name,
      school: a.school,
      grade: a.grade,
      eventCode: a.eventCode,
      elo: a.progress.elo,
      questions: a.progress.answered,
      accuracy: a.progress.answered ? Math.round((a.progress.correct / a.progress.answered) * 100) : 0,
      chapterId: a.chapterId,
      online: a.id === account?.id,
      lastActiveDays: 0,
      isMe: a.id === account?.id,
      isDemo: false,
    }))
    const demo: PlayerRow[] = DEMO_PLAYERS.map((p) => ({ ...p, isMe: false, isDemo: true }))
    return [...demo, ...real].sort((a, b) => b.elo - a.elo)
  }, [state.accounts, account?.id])

  const chapters = useMemo<ChapterRow[]>(() => {
    const all = [...DEMO_CHAPTERS.map((c) => ({ ...c, isDemo: true })), ...state.chapters.map((c) => ({ ...c, isDemo: false }))]
    return all
      .map((c) => {
        const m = state.meta[c.id]
        const gone = new Set([...(m?.removed ?? []), ...(m?.banned ?? [])])
        const members = players.filter((p) => p.chapterId === c.id && !gone.has(p.id))
        return { id: c.id, name: c.name, school: c.school, code: c.code, members, totalElo: members.reduce((s, p) => s + p.elo, 0), isDemo: c.isDemo }
      })
      .sort((a, b) => b.totalElo - a.totalElo)
  }, [players, state.chapters, state.meta])

  const myChapter = me?.chapterId ? chapters.find((c) => c.id === me.chapterId) ?? null : null
  // Rank is 0 until you have earned ELO; no made-up placement.
  const myRank = account && account.progress.elo > 0 ? players.findIndex((p) => p.id === account.id) + 1 : 0

  const deck = useMemo<DeckCard[]>(() => {
    if (!me) return BUILT_IN_DECK
    const mine = state.vocab.filter((v) => v.authorId === me.id || (!!me.chapterId && v.chapterId === me.chapterId))
    return [...BUILT_IN_DECK, ...mine.map((v) => ({ id: v.id, term: v.term, def: v.def, exam: v.exam, custom: v }))]
  }, [state.vocab, me?.id, me?.chapterId])

  const myAssignments = me?.chapterId ? (state.meta[me.chapterId]?.assignments ?? []).filter((a) => isAssignedTo(a, me.id)) : []

  const updateAccount = (fn: (a: Account) => Account) =>
    setState((s) => (s.session?.kind === 'user' ? { ...s, accounts: s.accounts.map((a) => (a.id === (s.session as { userId: string }).userId ? fn(a) : a)) } : s))

  const findChapterByCode = (code: string) => {
    const c = code.trim().toUpperCase()
    return DEMO_CHAPTERS.find((x) => x.code === c) ?? state.chapters.find((x) => x.code === c)
  }

  const store: Store = {
    ready: true,
    isGuest,
    signedIn: !!state.session,
    me,
    players,
    chapters,
    myChapter,
    myRank,
    deck,
    myAssignments,
    chapterMeta: (id) => ({ ...emptyMeta(), ...state.meta[id] }),

    startGuest: (eventCode) => setState((s) => ({ ...s, session: { kind: 'guest', eventCode } })),

    register: async (input) => {
      const email = input.email.trim().toLowerCase()
      if (!email || !input.password || !input.name.trim() || !input.school.trim()) return 'Fill in every field.'
      if (input.password.length < 6) return 'Use a password with at least 6 characters.'
      if (!eventByCode(input.eventCode)) return 'Pick your event.'
      if (state.accounts.some((a) => a.email === email)) return 'An account with that email already exists on this device.'
      let chapterId: string | null = null
      if (input.chapterCode?.trim()) {
        const c = findChapterByCode(input.chapterCode)
        if (!c) return 'No chapter has that code. Check it with your chapter president.'
        chapterId = c.id
      }
      const passHash = await hash(input.password)
      const acct: Account = {
        id: `u_${uid()}`,
        email,
        passHash,
        name: input.name.trim(),
        school: input.school.trim(),
        grade: input.grade,
        eventCode: input.eventCode,
        chapterId,
        // A guest who signs up keeps the practice they already did.
        progress: state.session?.kind === 'guest' ? state.guest : emptyProgress(),
        createdAt: new Date().toISOString(),
      }
      // Terms a guest added move to the new account too.
      const wasGuest = state.session?.kind === 'guest'
      setState((s) => ({
        ...s,
        accounts: [...s.accounts, acct],
        session: { kind: 'user', userId: acct.id },
        guest: emptyProgress(),
        vocab: wasGuest ? s.vocab.map((v) => (v.authorId === 'guest' ? { ...v, authorId: acct.id, author: acct.name } : v)) : s.vocab,
      }))
      return null
    },

    login: async (email, password) => {
      const acct = state.accounts.find((a) => a.email === email.trim().toLowerCase())
      if (!acct || acct.passHash !== (await hash(password))) return 'Email or password is incorrect.'
      setState((s) => ({ ...s, session: { kind: 'user', userId: acct.id } }))
      return null
    },

    logout: () => setState((s) => ({ ...s, session: null })),

    setEvent: (code) => {
      if (isGuest) setState((s) => ({ ...s, session: { kind: 'guest', eventCode: code } }))
      else updateAccount((a) => ({ ...a, eventCode: code }))
    },

    record: (a, perCorrect = 8) => {
      const delta = a.unranked || a.total === 0 ? 0 : eloDelta(a.correct, a.total, perCorrect)
      const apply = (p: Progress): Progress => {
        const today = dayKey()
        const yesterday = dayKey(new Date(Date.now() - 86400000))
        const streak = p.lastDay === today ? p.streak : p.lastDay === yesterday ? p.streak + 1 : 1
        const ex = p.byExam[a.exam] ?? { answered: 0, correct: 0 }
        const entry = { ...a, id: uid(), date: new Date().toISOString(), eloDelta: delta }
        if (a.unranked) return { ...p, seconds: p.seconds + a.seconds, streak, bestStreak: Math.max(p.bestStreak, streak), lastDay: today, history: [entry, ...p.history].slice(0, 200) }
        return {
          ...p,
          elo: Math.max(0, p.elo + delta),
          answered: p.answered + a.total,
          correct: p.correct + a.correct,
          seconds: p.seconds + a.seconds,
          streak,
          bestStreak: Math.max(p.bestStreak, streak),
          lastDay: today,
          byExam: { ...p.byExam, [a.exam]: { answered: ex.answered + a.total, correct: ex.correct + a.correct } },
          history: [entry, ...p.history].slice(0, 200),
          arena: a.arena ? { w: p.arena.w + (a.arena.won ? 1 : 0), l: p.arena.l + (a.arena.won ? 0 : 1) } : p.arena,
        }
      }
      if (isGuest) setState((s) => ({ ...s, guest: apply(s.guest) }))
      else updateAccount((acct) => ({ ...acct, progress: apply(acct.progress) }))
      return delta
    },

    createChapter: (name, school) => {
      if (!account) return
      const ch: LocalChapter = { id: `c_${uid()}`, name: name.trim(), school: school.trim(), code: makeChapterCode(school), createdBy: account.id }
      setState((s) => ({
        ...s,
        chapters: [...s.chapters, ch],
        meta: { ...s.meta, [ch.id]: { ...emptyMeta(), roles: { [account.id]: 'President' } } },
        accounts: s.accounts.map((a) => (a.id === account.id ? { ...a, chapterId: ch.id } : a)),
      }))
    },

    joinChapter: (code) => {
      if (!account) return 'Create an account to join a chapter.'
      const c = findChapterByCode(code)
      if (!c) return 'No chapter has that code. Check it with your chapter president.'
      if (state.meta[c.id]?.banned.includes(account.id)) return 'You have been removed from that chapter.'
      updateAccount((a) => ({ ...a, chapterId: c.id }))
      return null
    },

    leaveChapter: () => updateAccount((a) => ({ ...a, chapterId: null })),

    updateMeta: (chapterId, fn) => setState((s) => ({ ...s, meta: { ...s.meta, [chapterId]: fn({ ...emptyMeta(), ...s.meta[chapterId] }) } })),

    addVocab: (terms, share) => {
      if (!me) return
      const created = new Date().toISOString()
      const rows: VocabTerm[] = terms.map((t) => ({ ...t, id: `cv-${uid()}`, authorId: me.id, author: me.name, chapterId: share ? me.chapterId : null, created }))
      setState((s) => ({ ...s, vocab: [...s.vocab, ...rows] }))
    },

    // Only the author can change or delete a term.
    editVocab: (id, patch) => setState((s) => ({ ...s, vocab: s.vocab.map((v) => (v.id === id && v.authorId === me?.id ? { ...v, ...patch } : v)) })),
    deleteVocab: (id) => setState((s) => ({ ...s, vocab: s.vocab.filter((v) => !(v.id === id && v.authorId === me?.id)) })),

    completeAssignment: (id, r) => {
      const chapterId = me?.chapterId
      if (!chapterId || !me) return
      const entry: AssignmentResult = { date: new Date().toISOString(), ...r }
      setState((s) => {
        const m = { ...emptyMeta(), ...s.meta[chapterId] }
        const assignments = m.assignments.map((a) => (a.id === id ? { ...a, results: { ...a.results, [me.id]: entry } } : a))
        return { ...s, meta: { ...s.meta, [chapterId]: { ...m, assignments } } }
      })
    },
  }

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>
}

export const useStore = () => {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

/** The event, cluster and exam the current user practices for. */
export function useMyEvent() {
  const { me } = useStore()
  const ev = eventByCode(me?.eventCode ?? '') ?? eventByCode('PMK')!
  const cluster = CLUSTERS.find((c) => c.id === ev.cluster)!
  return { event: ev, cluster, exam: ev.exam }
}

/** ELO after each session, oldest first, starting from 0. */
export const eloSeries = (history: { eloDelta: number }[]) => {
  let elo = 0
  return [0, ...[...history].reverse().map((h) => (elo = Math.max(0, elo + h.eloDelta)))]
}
