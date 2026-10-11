# Product

<!-- impeccable:product-schema 1 -->

> Written 2026-10-11 by the deca-universe track without a live interview: this run is an unattended Omega workflow
> subagent with no question tool. Every fact below comes from the Omega master plan, the user's recorded decisions
> (hq/OMEGA_MASTER_PLAN.md section 3, the 2026-10-11 content policy), the repo README and the hq research files.
> Lines marked (inferred) are this track's reading of that material, not something the user confirmed.

## Platform

web

## Users

- High school DECA members in Ontario and across North America (many are minors), preparing for their cluster
  exam and their role play or case study at district, provincial/state and ICDC level. They study on phones between
  classes and on laptops at home. (Phone-first is a recorded user decision.)
- Chapter leaders and advisors who point members at a practice tool. (inferred)
- The owner (Joseph) who reads aggregate analytics and imports content.

## Product Purpose

DECA Masters is an independent study tool, made by two students (Joseph and Kaden), for DECA's competitive events:
timed cluster-exam practice graded on the server, a role-play prep and presentation trainer timed to each event's
official format, vocab flashcards on a spaced-repetition schedule, progress over time and an events explorer.
Success: a member can pick their event, practise the exact format they will face, and see what to work on next.

## Positioning

Built around DECA's real event structure (60 high school events, 6 career clusters, 7 cluster exams of 100 questions,
10 minute prep and 10 minute interview role plays) with every content item credited to its source and licence, and
answer keys that never reach the browser. It is honest about what it has: placeholders are labelled, nothing is
faked. (inferred from the README rules and the content policy)

## Operating Context

- Members practise alone, without a coach (USER_NEEDS.md: role-play reps depend on a coach being available).
- Official materials are scattered (deca.org, DECA Guide on Issuu, DECA+ behind a chapter purchase).
- DECA+ exam content may not be posted on any website; the site links to DECA's own public samples instead.

## Capabilities and Constraints

- Stack: Vite 8, React 19, TypeScript 7, Tailwind 4, React Router 7, Supabase (shared project with FBLA, `deca_*`
  objects only), three + React Three Fiber 9 + drei 10, Motion, lucide-react icons only.
- Routes planned by the Omega route map: landing/dashboard, auth, onboarding, events explorer, practice exams (run and
  review), role-play trainer, vocab decks, progress, leaderboard, profile and settings, owner console, terms,
  privacy, credits.
- Content: openly licensed questions and terms with visible attribution, or labelled placeholders. No AI-written
  questions, vocab or role plays (user decision 2026-10-11).
- Undecided: final question bank sizes per exam (the content track is still sourcing).

## Brand Commitments

- Name "DECA Masters". Independent, not affiliated with or endorsed by DECA Inc.; say so in the footer.
- Do not use or alter DECA's diamond logo or trade dress (DECA's Acceptable Use Policy reserves it for chartered
  associations and chapters).
- Footer credit: "Built with <heart icon> by Joseph & Kaden", Terms and Privacy links.
- Visual direction pinned by the Omega brief: "The Competition Terminal" (deep navy, electric blue, refined white,
  purposeful glass and metal, diamond-inspired geometry that is not the logo) and the 3D "DECA Strategy Universe".
  It must be clearly different from FBLA's gold/glass Leadership Observatory.
- Style bans (user decision): corners 2 to 6px, no purple gradients, no glass cards everywhere, no particle filler,
  no emoji icons, no AI-template tells. Casual, direct, concise copy; Canadian spelling; no em dashes.

## Evidence on Hand

- `hq/deca-content/events.json`: 60 high school events with official URLs and format facts (prep/present minutes,
  PI counts, scoring notes), verified 2026-10-11. Lands in `content/events.json` via the content track.
- DECA format facts from deca.org and decaplus.org (hq/research/DECA_BRAND_RESEARCH.md).
- No users yet, no testimonials, no usage numbers, no scores. None may be invented.

## Product Principles

1. Practise the real format: timings, counts and structure come from DECA's published rules.
2. Honest by default: no fake activity, counts or players; placeholders say they are placeholders.
3. Credit every item: source and licence travel with each question and term.
4. Phone first, keyboard fast: every tool works one-handed on a phone and from the keyboard on a laptop.

## Accessibility & Inclusion

WCAG 2.2 AA contrast, visible focus, 44px touch targets, reduced motion respected (3D off or static), keyboard
reachable everything. Users may be Ontario minors (PIPEDA, plain language).
