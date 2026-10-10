// Demo accounts and chapters so leaderboards and chapters have people in them.
// Everything here is fake and generated from a fixed seed, so it is identical on
// every load. Remove this file once real accounts come from the backend.
import { DECA_EVENTS } from './events'

export type DemoPlayer = {
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
}

export type DemoChapter = { id: string; name: string; school: string; code: string }

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(20261010)
const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)]
const int = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1))

const FIRST = ['Maya', 'Arjun', 'Sofia', 'Ethan', 'Priya', 'Jordan', 'Ava', 'Noah', 'Liam', 'Zoe', 'Hannah', 'Mateo', 'Aaliyah', 'Daniel', 'Grace', 'Omar', 'Isabella', 'Lucas', 'Chloe', 'Elijah', 'Nina', 'Ryan', 'Leila', 'Caleb', 'Ananya', 'Marcus', 'Emily', 'Jamal', 'Sara', 'Kevin', 'Olivia', 'Diego', 'Fatima', 'Tyler', 'Mei', 'Brandon', 'Rosa', 'Andre', 'Julia', 'Samir', 'Kayla', 'Victor', 'Hana', 'Owen', 'Camila', 'Isaac', 'Riya', 'Gabriel', 'Tessa', 'Malik']
const LAST = ['Chen', 'Patel', 'Ramirez', 'Brooks', 'Nair', 'Lee', 'Thompson', 'Kim', 'Garcia', 'Martin', 'Wu', 'Nguyen', 'Johnson', 'Singh', 'Hernandez', 'Okafor', 'Rossi', 'Cohen', 'Ali', 'Park', 'Bennett', 'Shah', 'Lopez', 'Murphy', 'Ito', 'Mensah', 'Reyes', 'Kowalski', 'Haddad', 'Fischer', 'Morales', 'Dubois', 'Khan', 'Owens', 'Silva', 'Novak', 'Ahmed', 'Price', 'Castillo', 'Tanaka']

const SCHOOLS = [
  'Lincoln High School', 'Westview High School', 'Northridge Academy', 'Lakeside High School', 'Riverside High School', 'Summit High School',
  'Cedar Ridge High School', 'Oak Park High School', 'Harbor View High School', 'Maple Grove High School', 'Eastwood High School', 'Pine Valley High School',
]

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
/** Chapter join code like LINC-7Q4K: four letters from the school, four random characters. */
export const makeChapterCode = (school: string, rnd: () => number = Math.random) => {
  const head = school.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase().padEnd(4, 'X')
  let tail = ''
  for (let i = 0; i < 4; i++) tail += CODE_CHARS[Math.floor(rnd() * CODE_CHARS.length)]
  return `${head}-${tail}`
}
const codeFor = (school: string) => makeChapterCode(school, rand)

export const DEMO_CHAPTERS: DemoChapter[] = SCHOOLS.map((school, i) => ({
  id: `dc${i}`,
  name: `${school.replace(/ (High School|Academy)$/, '')} DECA`,
  school,
  code: codeFor(school),
}))

const usedNames = new Set<string>()
export const DEMO_PLAYERS: DemoPlayer[] = Array.from({ length: 160 }, (_, i) => {
  let name = ''
  do name = `${pick(FIRST)} ${pick(LAST)}`
  while (usedNames.has(name))
  usedNames.add(name)
  const chapterIdx = int(0, SCHOOLS.length - 1)
  const skill = rand()
  const questions = int(40, 2400)
  return {
    id: `demo${i}`,
    name,
    school: SCHOOLS[chapterIdx],
    grade: int(9, 12),
    eventCode: pick(DECA_EVENTS).code,
    elo: Math.round(150 + skill * 2100 + rand() * 120),
    questions,
    accuracy: Math.round(48 + skill * 42),
    chapterId: rand() < 0.85 ? DEMO_CHAPTERS[chapterIdx].id : null,
    online: rand() < 0.18,
    lastActiveDays: int(0, 14),
  }
}).sort((a, b) => b.elo - a.elo)
