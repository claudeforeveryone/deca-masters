# DECA Masters

Online practice and competition platform for DECA chapters: cluster-exam practice with ELO, 1v1 Arena matches, chapter classrooms and leaderboards. Palette: dark blue (`#0A2342`), DECA blue (`#0072CE`), light blue (`#4FA8F0` / `#E3F1FD`) and white. Layout inspired by decaquizzer.com.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

Stack: Vite, React 18, TypeScript, Tailwind CSS, React Router, lucide-react.

## Pages (top bar)

| Tab | What's there |
| --- | --- |
| **Home** | Hero, ELO/streak/accuracy cards, Daily / Endless / Weak Spots shortcuts, ELO chart, chapter feed, top players |
| **Leaderboard** | Players (podium + searchable list) and Chapters (ranked by total member ELO) |
| **Play** | Daily, Endless, Weak Spots, Timed Sprint, trainer assignments, practice exams per event |
| **Vocab** | Flashcards filtered by event with mastery tracking |
| **Arena** | Challenge online players, friends or anyone; incoming/sent requests; 10-question timed 1v1 (most correct wins, ties go to faster time) |
| **Chapter** | Join by code or register a chapter. Classroom (announcements, links, president newsletters, weekly email + inactivity nudge toggles), chapter leaderboard, members (roles, remove, ban), event trainers (1–2 per event), attendance, insights (scores, weaknesses, activity), assignments and test builder (create, shuffle, edit) |
| **Me** | Profile (photo, school, grade, ELO), stats, accuracy by section, mini leaderboard, achievements; **Career** tab with sortable past exams and a wrong-answer bank you can filter and redo |

Notifications (challenges, chapter posts, assignments, streaks, rank changes) live in the bell in the top bar.

Events: Entrepreneurship, Finance, Marketing, Hospitality & Tourism, Business Management, Principles & Core.

## Status

This is the **front-end design** running on mock data (`src/data/mock.ts`). The chapter "Preview as" dropdown switches between President / Executive / Trainer / Member permissions. Arena opponents are simulated.

## Next steps

- Auth + database (e.g. Supabase): users, chapters, memberships/roles, questions, attempts, ELO history
- Realtime Arena matches and challenge requests
- Scheduled weekly overview + inactivity emails
- Real question bank import
- Logo: `src/components/Logo.tsx` is a placeholder mark. Swap in the official DECA logo only with permission (DECA's brand guidelines restrict its use).
