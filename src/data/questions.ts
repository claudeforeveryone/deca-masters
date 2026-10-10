import type { ExamId } from './events'

// Sample questions written in the style of DECA cluster exams. They are placeholders
// for the real question bank, which will be loaded from the backend.
export type Question = {
  id: string
  exam: ExamId
  area: string // instructional area
  prompt: string
  choices: string[]
  answer: number
  explanation: string
}

const q = (id: string, exam: ExamId, area: string, prompt: string, choices: string[], answer: number, explanation: string): Question => ({
  id, exam, area, prompt, choices, answer, explanation,
})

export const QUESTIONS: Question[] = [
  // Business Administration Core
  q('bac1', 'bac', 'Economics', 'When the price of a product rises and the quantity demanded falls, this illustrates the', ['law of supply', 'law of demand', 'law of diminishing returns', 'principle of scarcity'], 1, 'The law of demand: as price increases, quantity demanded decreases, all else equal.'),
  q('bac2', 'bac', 'Communication Skills', 'Which of the following is an example of nonverbal communication?', ['An email', 'A phone call', 'Eye contact', 'A memo'], 2, 'Eye contact, posture and gestures are nonverbal cues.'),
  q('bac3', 'bac', 'Economics', 'The value of the next-best alternative you give up when making a choice is called', ['sunk cost', 'opportunity cost', 'marginal cost', 'fixed cost'], 1, 'Opportunity cost is what you give up by choosing one option over the next-best one.'),
  q('bac4', 'bac', 'Professional Development', 'An employee who arrives on time, meets deadlines and follows through on commitments is demonstrating', ['creativity', 'dependability', 'flexibility', 'assertiveness'], 1, 'Dependability means others can count on you to do what you said you would.'),
  q('bac5', 'bac', 'Business Law', 'A legally binding agreement between two or more parties is a', ['warranty', 'contract', 'lien', 'tariff'], 1, 'A contract is an agreement the law will enforce.'),

  // Business Management and Administration
  q('bma1', 'bma', 'Operations', 'Which management function involves setting goals and deciding how to achieve them?', ['Organizing', 'Controlling', 'Planning', 'Staffing'], 2, 'Planning sets objectives and the course of action to reach them.'),
  q('bma2', 'bma', 'Human Resources Management', 'The number of employees a manager directly supervises is the manager’s', ['chain of command', 'span of control', 'line authority', 'delegation'], 1, 'Span of control is how many people report directly to one manager.'),
  q('bma3', 'bma', 'Human Resources Management', 'A structured process for measuring how well an employee is doing their job is a', ['performance appraisal', 'job analysis', 'exit interview', 'orientation'], 0, 'A performance appraisal evaluates an employee’s work against expectations.'),
  q('bma4', 'bma', 'Business Law', 'A business that must follow rules set by OSHA is dealing with regulations about', ['advertising', 'workplace safety', 'product pricing', 'taxes'], 1, 'OSHA sets and enforces workplace safety and health standards.'),
  q('bma5', 'bma', 'Quality Management', 'Continuously making small improvements to processes is known as', ['kaizen', 'outsourcing', 'downsizing', 'benchmarking'], 0, 'Kaizen is the practice of continuous, incremental improvement.'),

  // Entrepreneurship
  q('ent1', 'ent', 'Business Planning', 'What section of a business plan describes the company’s target customers and competitors?', ['Executive summary', 'Market analysis', 'Financial plan', 'Appendix'], 1, 'The market analysis covers the industry, target market and competition.'),
  q('ent2', 'ent', 'Financing', 'Money invested in a startup in exchange for ownership is called', ['debt financing', 'equity financing', 'a grant', 'trade credit'], 1, 'Equity financing trades ownership shares for capital.'),
  q('ent3', 'ent', 'Financing', 'Starting a business using personal savings and early revenue instead of outside investors is called', ['bootstrapping', 'leveraging', 'crowdfunding', 'franchising'], 0, 'Bootstrapping means funding growth yourself.'),
  q('ent4', 'ent', 'Business Planning', 'A short summary that appears first in a business plan and highlights its key points is the', ['mission statement', 'executive summary', 'appendix', 'SWOT analysis'], 1, 'The executive summary gives readers the whole plan at a glance.'),
  q('ent5', 'ent', 'Risk Management', 'An entrepreneur who buys insurance to cover property damage is', ['avoiding risk', 'transferring risk', 'retaining risk', 'ignoring risk'], 1, 'Insurance transfers the financial risk to the insurer.'),

  // Finance
  q('fin1', 'fin', 'Financial Analysis', 'Which financial statement shows assets, liabilities and owner’s equity at a specific point in time?', ['Income statement', 'Balance sheet', 'Cash flow statement', 'Budget'], 1, 'The balance sheet is a snapshot of assets = liabilities + equity on a given date.'),
  q('fin2', 'fin', 'Risk Management', 'Spreading investments across many different assets to reduce risk is called', ['leveraging', 'hedging', 'diversification', 'liquidation'], 2, 'Diversification reduces exposure to any single asset.'),
  q('fin3', 'fin', 'Financial Analysis', 'How quickly an asset can be turned into cash without losing value is its', ['liquidity', 'solvency', 'equity', 'yield'], 0, 'Liquidity measures how easily an asset converts to cash.'),
  q('fin4', 'fin', 'Accounting', 'Revenue minus cost of goods sold equals', ['net income', 'gross profit', 'operating expenses', 'retained earnings'], 1, 'Gross profit is what remains after subtracting the cost of goods sold.'),
  q('fin5', 'fin', 'Accounting', 'Every transaction affects at least two accounts under the', ['cash basis', 'double-entry system', 'single-entry system', 'accrual method'], 1, 'Double-entry bookkeeping records a debit and a matching credit.'),

  // Hospitality and Tourism
  q('ht1', 'ht', 'Customer Relations', 'A hotel employee who anticipates a guest’s needs before they are expressed is demonstrating', ['upselling', 'proactive service', 'yield management', 'cross-training'], 1, 'Proactive service means meeting needs before the guest asks.'),
  q('ht2', 'ht', 'Operations', 'Revenue per available room (RevPAR) is used to measure a hotel’s', ['guest satisfaction', 'room revenue performance', 'staff turnover', 'food costs'], 1, 'RevPAR combines occupancy and rate into one performance figure.'),
  q('ht3', 'ht', 'Pricing', 'Changing room rates based on expected demand is called', ['yield management', 'cost-plus pricing', 'price fixing', 'bundling'], 0, 'Yield (revenue) management adjusts prices to demand to maximize revenue.'),
  q('ht4', 'ht', 'Selling', 'Suggesting a room upgrade to a guest who is already booking is an example of', ['cross-selling', 'upselling', 'prospecting', 'cold calling'], 1, 'Upselling encourages a customer to buy a higher-value version.'),
  q('ht5', 'ht', 'Operations', 'The front-of-house area of a hotel where guests check in is the', ['back office', 'front desk', 'housekeeping', 'concierge lounge'], 1, 'The front desk handles check-in, check-out and guest requests.'),

  // Marketing
  q('mkt1', 'mkt', 'Market Planning', 'A company that divides its market into groups based on lifestyle and values is using which type of segmentation?', ['Geographic', 'Demographic', 'Psychographic', 'Behavioral'], 2, 'Psychographic segmentation groups customers by lifestyle, values and attitudes.'),
  q('mkt2', 'mkt', 'Promotion', 'Paying a well-known athlete to recommend a product is an example of', ['publicity', 'an endorsement', 'personal selling', 'a rebate'], 1, 'An endorsement is a paid statement of support from a recognizable figure.'),
  q('mkt3', 'mkt', 'Channel Management', 'The path a product takes from producer to final consumer is its', ['supply curve', 'channel of distribution', 'product mix', 'value chain'], 1, 'The channel of distribution moves goods from producer to user.'),
  q('mkt4', 'mkt', 'Market Planning', 'A company’s sales as a percentage of total industry sales is its', ['market share', 'market potential', 'sales quota', 'profit margin'], 0, 'Market share compares a company’s sales to the whole market.'),
  q('mkt5', 'mkt', 'Pricing', 'Setting a low initial price to quickly gain market share is called', ['price skimming', 'penetration pricing', 'prestige pricing', 'odd pricing'], 1, 'Penetration pricing starts low to attract buyers fast.'),

  // Personal Financial Literacy
  q('pfl1', 'pfl', 'Saving', 'Interest earned on both the original deposit and previously earned interest is', ['simple interest', 'compound interest', 'a dividend', 'principal'], 1, 'Compound interest grows on interest already earned.'),
  q('pfl2', 'pfl', 'Credit', 'Which factor has the largest effect on a FICO credit score?', ['Payment history', 'Length of credit history', 'New credit', 'Types of credit'], 0, 'Payment history makes up the largest share of a FICO score.'),
  q('pfl3', 'pfl', 'Budgeting', 'Money set aside to cover unexpected expenses like car repairs is a(n)', ['emergency fund', 'retirement account', 'line of credit', 'escrow account'], 0, 'An emergency fund covers surprises without taking on debt.'),
  q('pfl4', 'pfl', 'Earning Income', 'The amount of pay left after taxes and deductions is', ['gross pay', 'net pay', 'salary', 'overtime'], 1, 'Net pay is your take-home pay.'),
  q('pfl5', 'pfl', 'Investing', 'Which investment generally carries the highest risk and potential return?', ['Savings account', 'Certificate of deposit', 'Individual stocks', 'Government bonds'], 2, 'Individual stocks can swing widely in value, so risk and potential return are higher.'),
]

export const questionsFor = (exam: ExamId) => QUESTIONS.filter((x) => x.exam === exam)

export const VOCAB: { term: string; def: string; exam: ExamId }[] = [
  { term: 'Opportunity cost', def: 'The value of the next-best alternative given up when making a choice.', exam: 'bac' },
  { term: 'Contract', def: 'A legally binding agreement between two or more parties.', exam: 'bac' },
  { term: 'Span of control', def: 'The number of employees a manager directly supervises.', exam: 'bma' },
  { term: 'Kaizen', def: 'A practice of making small, continuous improvements to processes.', exam: 'bma' },
  { term: 'Bootstrapping', def: 'Starting a business using personal savings and revenue rather than outside capital.', exam: 'ent' },
  { term: 'Equity financing', def: 'Raising money by selling ownership shares in a business.', exam: 'ent' },
  { term: 'Liquidity', def: 'How quickly an asset can be converted to cash without losing value.', exam: 'fin' },
  { term: 'Gross profit', def: 'Revenue minus cost of goods sold.', exam: 'fin' },
  { term: 'RevPAR', def: 'Revenue per available room, a key hotel performance metric.', exam: 'ht' },
  { term: 'Yield management', def: 'Adjusting prices based on expected demand to maximize revenue.', exam: 'ht' },
  { term: 'Market share', def: 'A company’s sales as a percentage of total industry sales.', exam: 'mkt' },
  { term: 'Channel of distribution', def: 'The path a product takes from producer to final consumer.', exam: 'mkt' },
  { term: 'Compound interest', def: 'Interest earned on both the principal and previously earned interest.', exam: 'pfl' },
  { term: 'Net pay', def: 'Take-home pay after taxes and deductions.', exam: 'pfl' },
]
