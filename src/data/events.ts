// DECA high school competitive events that include a multiple-choice exam,
// taken from the "Exam" field on each event page at deca.org/compete (2025-26).
// Prepared events with no exam (business plans, projects, operations research,
// online simulations) are left out because there is nothing to practice for them.

/** The six career clusters on deca.org, with their official colours. */
export const CLUSTERS = [
  { id: 'bma', name: 'Business Management and Administration', short: 'Business Management', color: '#F7BC00', fg: '#141414' },
  { id: 'ent', name: 'Entrepreneurship', short: 'Entrepreneurship', color: '#7C8689', fg: '#FFFFFF' },
  { id: 'fin', name: 'Finance', short: 'Finance', color: '#009B46', fg: '#FFFFFF' },
  { id: 'ht', name: 'Hospitality and Tourism', short: 'Hospitality and Tourism', color: '#0B74BF', fg: '#FFFFFF' },
  { id: 'mkt', name: 'Marketing', short: 'Marketing', color: '#CC1D36', fg: '#FFFFFF' },
  { id: 'pfl', name: 'Personal Financial Literacy', short: 'Personal Financial Literacy', color: '#91C659', fg: '#141414' },
] as const
export type ClusterId = (typeof CLUSTERS)[number]['id']

/** Each exam DECA writes. Principles events all take the Business Administration Core exam. */
export const EXAMS = [
  { id: 'bac', name: 'Business Administration Core', color: '#002D6B', fg: '#FFFFFF' },
  { id: 'bma', name: 'Business Management and Administration', color: '#F7BC00', fg: '#141414' },
  { id: 'ent', name: 'Entrepreneurship', color: '#7C8689', fg: '#FFFFFF' },
  { id: 'fin', name: 'Finance', color: '#009B46', fg: '#FFFFFF' },
  { id: 'ht', name: 'Hospitality and Tourism', color: '#0B74BF', fg: '#FFFFFF' },
  { id: 'mkt', name: 'Marketing', color: '#CC1D36', fg: '#FFFFFF' },
  { id: 'pfl', name: 'Personal Financial Literacy', color: '#91C659', fg: '#141414' },
] as const
export type ExamId = (typeof EXAMS)[number]['id']

export type DecaEvent = { code: string; name: string; cluster: ClusterId; exam: ExamId; type: string }

const e = (code: string, name: string, cluster: ClusterId, exam: ExamId, type: string): DecaEvent => ({ code, name, cluster, exam, type })

export const DECA_EVENTS: DecaEvent[] = [
  // Business Management and Administration
  e('PBM', 'Principles of Business Management and Administration', 'bma', 'bac', 'Principles'),
  e('HRM', 'Human Resources Management Series', 'bma', 'bma', 'Individual Series'),
  e('BLTDM', 'Business Law and Ethics Team Decision Making', 'bma', 'bma', 'Team Decision Making'),
  // Entrepreneurship
  e('PEN', 'Principles of Entrepreneurship', 'ent', 'bac', 'Principles'),
  e('ENT', 'Entrepreneurship Series', 'ent', 'ent', 'Individual Series'),
  e('ETDM', 'Entrepreneurship Team Decision Making', 'ent', 'ent', 'Team Decision Making'),
  // Finance
  e('PFN', 'Principles of Finance', 'fin', 'bac', 'Principles'),
  e('ACT', 'Accounting Applications Series', 'fin', 'fin', 'Individual Series'),
  e('BFS', 'Business Finance Series', 'fin', 'fin', 'Individual Series'),
  e('FTDM', 'Financial Services Team Decision Making', 'fin', 'fin', 'Team Decision Making'),
  e('FCE', 'Financial Consulting', 'fin', 'fin', 'Professional Selling and Consulting'),
  // Hospitality and Tourism
  e('PHT', 'Principles of Hospitality and Tourism', 'ht', 'bac', 'Principles'),
  e('HLM', 'Hotel and Lodging Management Series', 'ht', 'ht', 'Individual Series'),
  e('QSRM', 'Quick Serve Restaurant Management Series', 'ht', 'ht', 'Individual Series'),
  e('RFSM', 'Restaurant and Food Service Management Series', 'ht', 'ht', 'Individual Series'),
  e('HTDM', 'Hospitality Services Team Decision Making', 'ht', 'ht', 'Team Decision Making'),
  e('TTDM', 'Travel and Tourism Team Decision Making', 'ht', 'ht', 'Team Decision Making'),
  e('HTPS', 'Hospitality and Tourism Professional Selling', 'ht', 'ht', 'Professional Selling and Consulting'),
  // Marketing
  e('PMK', 'Principles of Marketing', 'mkt', 'bac', 'Principles'),
  e('AAM', 'Apparel and Accessories Marketing Series', 'mkt', 'mkt', 'Individual Series'),
  e('ASM', 'Automotive Services Marketing Series', 'mkt', 'mkt', 'Individual Series'),
  e('BSM', 'Business Services Marketing Series', 'mkt', 'mkt', 'Individual Series'),
  e('FMS', 'Food Marketing Series', 'mkt', 'mkt', 'Individual Series'),
  e('MCS', 'Marketing Communications Series', 'mkt', 'mkt', 'Individual Series'),
  e('RMS', 'Retail Merchandising Series', 'mkt', 'mkt', 'Individual Series'),
  e('SEM', 'Sports and Entertainment Marketing Series', 'mkt', 'mkt', 'Individual Series'),
  e('BTDM', 'Buying and Merchandising Team Decision Making', 'mkt', 'mkt', 'Team Decision Making'),
  e('MTDM', 'Marketing Management Team Decision Making', 'mkt', 'mkt', 'Team Decision Making'),
  e('STDM', 'Sports and Entertainment Marketing Team Decision Making', 'mkt', 'mkt', 'Team Decision Making'),
  e('PSE', 'Professional Selling', 'mkt', 'mkt', 'Professional Selling and Consulting'),
  e('IMCE', 'Integrated Marketing Campaign-Event', 'mkt', 'mkt', 'Integrated Marketing Campaign'),
  e('IMCP', 'Integrated Marketing Campaign-Product', 'mkt', 'mkt', 'Integrated Marketing Campaign'),
  e('IMCS', 'Integrated Marketing Campaign-Service', 'mkt', 'mkt', 'Integrated Marketing Campaign'),
  // Personal Financial Literacy
  e('PFL', 'Personal Financial Literacy', 'pfl', 'pfl', 'Personal Financial Literacy'),
]

export const clusterOf = (id: ClusterId) => CLUSTERS.find((c) => c.id === id)!
export const examOf = (id: ExamId) => EXAMS.find((x) => x.id === id)!
export const eventByCode = (code: string) => DECA_EVENTS.find((x) => x.code === code)
