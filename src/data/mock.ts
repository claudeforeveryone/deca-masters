// Mock data used until the backend (auth, realtime 1v1, chapters, email) is wired up.

// Colours are DECA's official career cluster colours (deca.org). fg keeps text readable on each.
export const EVENTS = [
  { id: 'entrepreneurship', name: 'Entrepreneurship', color: '#7C8689', fg: '#FFFFFF' },
  { id: 'finance', name: 'Finance', color: '#009B46', fg: '#FFFFFF' },
  { id: 'marketing', name: 'Marketing', color: '#CC1D36', fg: '#FFFFFF' },
  { id: 'hospitality', name: 'Hospitality & Tourism', color: '#0B74BF', fg: '#FFFFFF' },
  { id: 'management', name: 'Business Management', color: '#F7BC00', fg: '#141414' },
  { id: 'core', name: 'Principles & Core', color: '#002D6B', fg: '#FFFFFF' },
] as const

export type EventId = (typeof EVENTS)[number]['id']

export const eventOf = (id: EventId) => EVENTS.find((e) => e.id === id)!
export const eventName = (id: EventId) => eventOf(id).name

export type Player = {
  id: string
  name: string
  school: string
  chapter: string
  grade: number
  elo: number
  online?: boolean
}


const raw: [string, string, string, number, number, boolean?][] = [
  ['Maya Chen', 'Lincoln High', 'Lincoln DECA', 12, 2140, true],
  ['Arjun Patel', 'Westview High', 'Westview DECA', 11, 2085],
  ['Sofia Ramirez', 'Lincoln High', 'Lincoln DECA', 11, 1990, true],
  ['Ethan Brooks', 'Northridge Academy', 'Northridge DECA', 12, 1932],
  ['Priya Nair', 'Westview High', 'Westview DECA', 10, 1877, true],
  ['Jordan Lee', 'Lincoln High', 'Lincoln DECA', 11, 1810],
  ['Ava Thompson', 'Lakeside High', 'Lakeside DECA', 12, 1764],
  ['Noah Kim', 'Northridge Academy', 'Northridge DECA', 10, 1702, true],
  ['Liam Garcia', 'Lakeside High', 'Lakeside DECA', 9, 1650],
  ['Zoe Martin', 'Westview High', 'Westview DECA', 11, 1598],
  ['Alex Rivera', 'Lincoln High', 'Lincoln DECA', 11, 1544, true],
  ['Hannah Wu', 'Lakeside High', 'Lakeside DECA', 10, 1490],
]

export const PLAYERS: Player[] = raw.map(([name, school, chapter, grade, elo, online], i) => ({
  id: `p${i}`,
  name,
  school,
  chapter,
  grade,
  elo,
  online,
}))

export const ME = PLAYERS.find((p) => p.name === 'Alex Rivera')!

export const MY_STATS = {
  rank: PLAYERS.findIndex((p) => p.id === ME.id) + 1,
  questionsDone: 1284,
  accuracy: 78,
  timeSpentHrs: 41.5,
  streak: 9,
  bestStreak: 23,
  bestPaper: { name: 'Marketing Cluster Exam #4', score: 94 },
  arenaRecord: { w: 31, l: 12 },
  bySection: [
    { event: 'entrepreneurship' as EventId, accuracy: 82, done: 240 },
    { event: 'finance' as EventId, accuracy: 69, done: 198 },
    { event: 'marketing' as EventId, accuracy: 88, done: 310 },
    { event: 'hospitality' as EventId, accuracy: 74, done: 156 },
    { event: 'management' as EventId, accuracy: 77, done: 210 },
    { event: 'core' as EventId, accuracy: 71, done: 170 },
  ],
  eloHistory: [1200, 1260, 1240, 1310, 1355, 1340, 1402, 1450, 1430, 1488, 1520, 1544],
}

export const ACHIEVEMENTS = [
  { icon: 'trophy', title: 'Top 15 Global', desc: 'Reached the global top 15 on the player leaderboard', date: 'Sep 28' },
  { icon: 'flame', title: '20-Day Streak', desc: 'Practiced 20 days in a row', date: 'Sep 14' },
  { icon: 'target', title: 'Sharpshooter', desc: 'Scored 90%+ on a full 100-question exam', date: 'Aug 30' },
  { icon: 'swords', title: 'Arena Veteran', desc: 'Won 25 Arena 1v1 matches', date: 'Aug 21' },
  { icon: 'book', title: 'Vocab Master', desc: 'Mastered 500 vocab cards', date: 'Aug 2' },
  { icon: 'bolt', title: 'Speed Demon', desc: 'Finished a 10-question Arena match in under 90 seconds', date: 'Jul 19' },
]

export type Chapter = {
  id: string
  name: string
  school: string
  members: number
  totalElo: number
  president: string
}

export const CHAPTERS: Chapter[] = ['Lincoln DECA', 'Westview DECA', 'Northridge DECA', 'Lakeside DECA', 'Riverside DECA', 'Summit DECA']
  .map((name, i) => {
    const members = PLAYERS.filter((p) => p.chapter === name)
    return {
      id: `c${i}`,
      name,
      school: members[0]?.school ?? name.replace('DECA', 'High'),
      members: members.length ? members.length * 9 : 18 - i * 2,
      totalElo: members.length ? members.reduce((s, p) => s + p.elo, 0) * 9 : 21000 - i * 2400,
      president: members[0]?.name ?? 'TBD',
    }
  })
  .sort((a, b) => b.totalElo - a.totalElo)

export type Question = {
  id: string
  event: EventId
  instructionalArea: string
  prompt: string
  choices: string[]
  answer: number
  explanation: string
}

export const QUESTIONS: Question[] = [
  {
    id: 'q1', event: 'marketing', instructionalArea: 'Market Planning',
    prompt: 'A company that divides its market into groups based on lifestyle and values is using which type of segmentation?',
    choices: ['Geographic', 'Demographic', 'Psychographic', 'Behavioral'], answer: 2,
    explanation: 'Psychographic segmentation groups customers by lifestyle, values, attitudes, and personality.',
  },
  {
    id: 'q2', event: 'finance', instructionalArea: 'Financial Analysis',
    prompt: 'Which financial statement shows a business’s assets, liabilities, and owner’s equity at a specific point in time?',
    choices: ['Income statement', 'Balance sheet', 'Cash flow statement', 'Budget'], answer: 1,
    explanation: 'The balance sheet is a snapshot of assets = liabilities + equity on a given date.',
  },
  {
    id: 'q3', event: 'entrepreneurship', instructionalArea: 'Business Planning',
    prompt: 'What section of a business plan describes the company’s target customers and competitors?',
    choices: ['Executive summary', 'Market analysis', 'Financial plan', 'Appendix'], answer: 1,
    explanation: 'The market analysis covers the industry, target market, and competition.',
  },
  {
    id: 'q4', event: 'core', instructionalArea: 'Economics',
    prompt: 'When the price of a product rises and the quantity demanded falls, this illustrates the',
    choices: ['law of supply', 'law of demand', 'law of diminishing returns', 'principle of scarcity'], answer: 1,
    explanation: 'The law of demand: as price increases, quantity demanded decreases (all else equal).',
  },
  {
    id: 'q5', event: 'hospitality', instructionalArea: 'Customer Relations',
    prompt: 'A hotel employee who anticipates a guest’s needs before they are expressed is demonstrating',
    choices: ['upselling', 'proactive service', 'yield management', 'cross-training'], answer: 1,
    explanation: 'Proactive service means anticipating and meeting needs before the guest asks.',
  },
  {
    id: 'q6', event: 'management', instructionalArea: 'Operations',
    prompt: 'Which management function involves setting goals and deciding how to achieve them?',
    choices: ['Organizing', 'Controlling', 'Planning', 'Staffing'], answer: 2,
    explanation: 'Planning is the function of setting objectives and determining a course of action.',
  },
  {
    id: 'q7', event: 'marketing', instructionalArea: 'Promotion',
    prompt: 'Paying a well-known athlete to recommend a product is an example of',
    choices: ['publicity', 'an endorsement', 'personal selling', 'a rebate'], answer: 1,
    explanation: 'An endorsement is a paid statement of support from a recognizable figure.',
  },
  {
    id: 'q8', event: 'finance', instructionalArea: 'Risk Management',
    prompt: 'Spreading investments across many different assets to reduce risk is called',
    choices: ['leveraging', 'hedging', 'diversification', 'liquidation'], answer: 2,
    explanation: 'Diversification reduces exposure to any single asset’s risk.',
  },
  {
    id: 'q9', event: 'core', instructionalArea: 'Communication Skills',
    prompt: 'Which is an example of nonverbal communication?',
    choices: ['An email', 'A phone call', 'Eye contact', 'A memo'], answer: 2,
    explanation: 'Eye contact, posture, and gestures are nonverbal cues.',
  },
  {
    id: 'q10', event: 'entrepreneurship', instructionalArea: 'Financing',
    prompt: 'Money invested in a startup in exchange for ownership is called',
    choices: ['debt financing', 'equity financing', 'a grant', 'trade credit'], answer: 1,
    explanation: 'Equity financing trades ownership shares for capital.',
  },
]

export const VOCAB = [
  { term: 'Opportunity cost', def: 'The value of the next-best alternative given up when making a choice.', event: 'core' as EventId },
  { term: 'Market share', def: 'A company’s sales as a percentage of total industry sales.', event: 'marketing' as EventId },
  { term: 'Liquidity', def: 'How quickly an asset can be converted to cash without losing value.', event: 'finance' as EventId },
  { term: 'Bootstrapping', def: 'Starting a business using personal savings and revenue rather than outside capital.', event: 'entrepreneurship' as EventId },
  { term: 'RevPAR', def: 'Revenue per available room, a key hotel performance metric.', event: 'hospitality' as EventId },
  { term: 'Span of control', def: 'The number of employees a manager directly supervises.', event: 'management' as EventId },
  { term: 'Channel of distribution', def: 'The path a product takes from producer to final consumer.', event: 'marketing' as EventId },
  { term: 'Gross margin', def: 'Revenue minus cost of goods sold, often shown as a percentage of revenue.', event: 'finance' as EventId },
]

export type PastExam = {
  id: string
  name: string
  event: EventId
  date: string
  accuracy: number
  timeMin: number
  eloDelta: number
  wrongIds: string[]
}

export const PAST_EXAMS: PastExam[] = [
  { id: 'e1', name: 'Marketing Cluster Exam #4', event: 'marketing', date: '2026-10-08', accuracy: 94, timeMin: 52, eloDelta: 38, wrongIds: ['q7'] },
  { id: 'e2', name: 'Finance Cluster Exam #2', event: 'finance', date: '2026-10-05', accuracy: 66, timeMin: 61, eloDelta: -12, wrongIds: ['q2', 'q8'] },
  { id: 'e3', name: 'Daily Challenge, Oct 4', event: 'core', date: '2026-10-04', accuracy: 80, timeMin: 6, eloDelta: 9, wrongIds: ['q4', 'q9'] },
  { id: 'e4', name: 'Entrepreneurship Practice #1', event: 'entrepreneurship', date: '2026-10-01', accuracy: 72, timeMin: 48, eloDelta: 4, wrongIds: ['q3', 'q10'] },
  { id: 'e5', name: 'BM+A Cluster Exam #3', event: 'management', date: '2026-09-27', accuracy: 85, timeMin: 44, eloDelta: 21, wrongIds: ['q6'] },
  { id: 'e6', name: 'Hospitality Cluster Exam #1', event: 'hospitality', date: '2026-09-22', accuracy: 74, timeMin: 57, eloDelta: 6, wrongIds: ['q5'] },
]

export const NOTIFICATIONS = [
  { id: 'n1', kind: 'arena', text: 'Maya Chen challenged you to an Arena 1v1 (Marketing)', time: '2m ago', unread: true },
  { id: 'n2', kind: 'chapter', text: 'Lincoln DECA posted a new announcement: “States prep schedule”', time: '1h ago', unread: true },
  { id: 'n3', kind: 'assignment', text: 'Your Finance trainer assigned “Ratios flashcard set”', time: '3h ago', unread: true },
  { id: 'n4', kind: 'streak', text: 'Keep your 9-day streak alive. Today’s Daily is ready', time: '6h ago', unread: false },
  { id: 'n5', kind: 'rank', text: 'You moved up to #11 on the global leaderboard', time: '1d ago', unread: false },
]

export const ANNOUNCEMENTS = [
  { id: 'a1', type: 'Newsletter', author: 'Maya Chen', role: 'President', title: 'Weekly newsletter: week of Oct 6', body: 'District competition is 5 weeks out. Everyone should finish 2 full cluster exams this week. Roleplay practice is Thursday after school in Room 214.', date: 'Oct 6' },
  { id: 'a2', type: 'Announcement', author: 'Sofia Ramirez', role: 'VP Competitive Events', title: 'States prep schedule', body: 'Practice schedule for the next month is posted below. Attendance is taken at every session.', date: 'Oct 4' },
  { id: 'a3', type: 'Link', author: 'Jordan Lee', role: 'Finance Trainer', title: 'Finance performance indicators PDF', body: 'Review the performance indicators for your event before Thursday.', url: 'https://www.deca.org/compete', date: 'Oct 2' },
]

export const ATTENDANCE = [
  { date: 'Oct 9', present: 24, total: 27 },
  { date: 'Oct 2', present: 22, total: 27 },
  { date: 'Sep 25', present: 25, total: 27 },
  { date: 'Sep 18', present: 19, total: 26 },
]
