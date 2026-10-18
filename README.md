# DECA Masters

Practice for DECA cluster exams, role plays and vocab. An independent study tool made by students, not affiliated with
DECA Inc. Version 2 runs on Supabase (shared project `uhgzeuvybyohdbfuhfil`, DECA objects are `deca_*` only).

## Run

```bash
npm install
npm run dev -- --port 3301   # builds public/content first, then Vite
npm test                     # vitest (jsdom), --maxWorkers=4
npm run typecheck            # tsc -p tsconfig.json
npm run build                # content, typecheck, vite build
npm run check:content        # validate content/ against content/SCHEMA.md
```

`.env.local` is optional: `VITE_SUPABASE_URL` and `VITE_SUPABASE_KEY` default to the shared project's public URL and
publishable key (`.env.example`). Both are meant for the browser; row level security and SECURITY DEFINER RPCs
protect the data.

Stack (exact versions in `package.json`, matching FBLA): Vite 8, React 19.3, TypeScript 7, Tailwind 4
(`@tailwindcss/vite`, no config file: tokens live in CSS), React Router 7, supabase-js 2, vitest + Testing Library +
jsdom, lucide-react (the only icon set), three + React Three Fiber 9 + drei 10 + postprocessing, Motion.

## Folder conventions

| Path                                  | What goes there                                                                                                                                                                                                                                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/<area>.ts`                   | Typed calls, one file per domain (`profile`, `practice`, `vocab`, `roleplay`, `progress`, `leaderboard`, `owner`, `analytics`). Pages never call `supabase.from()` / `.rpc()` directly. Throw `ApiError` via `must()` / `toApiError()` from `core.ts`; SQL raises readable errors as `raise exception 'deca: ...'`. |
| `src/lib`                             | Framework-light logic and React context: `supabase.ts` (client, `appUrl`), `auth.tsx` (session, sign up/in/out, reset), `authErrors.ts`, `content.ts` (public content loader + types), `prefs.ts` / `theme.ts` (per-device UI prefs), `safeNext.ts`. Pure logic gets a `*.test.ts` next to it.                      |
| `src/components/ui`                   | Primitives: `Button` (+ `buttonClass` for links), `Field`, `Notice`, `Panel`, `PageHeader`, `EmptyState`. Read tokens, never raw hex.                                                                                                                                                                               |
| `src/components/layout`               | `AppShell` (navy top bar, phone tab bar, footer), `RequireAuth`, `ErrorBoundary`, `RouteFallback`, `PagePlaceholder`, `nav.ts` (one list drives both navs).                                                                                                                                                         |
| `src/pages/<area>/*Page.tsx`          | One route each, named export, lazy-loaded from `App.tsx` with `page()`.                                                                                                                                                                                                                                             |
| `src/three/*`                         | 3D only. Enter a page through `Mount3D` (lazy chunk, WebGL + reduced-motion + width + on-screen gates, poster fallback) and render with `Stage`. three.js must never reach the main bundle.                                                                                                                         |
| `src/styles/tokens.css`               | Every colour, font, space, radius and motion token, light and dark, bridged to Tailwind names.                                                                                                                                                                                                                      |
| `content/`                            | Source content with answer keys (server side only) + `SCHEMA.md`, `validate.mjs` (pure rules, browser-safe, typed by `validate.d.mts`), `check.mjs` (disk + CLI).                                                                                                                                                   |
| `scripts/build-content.mjs`           | Writes `public/content/` (gitignored) with answers and explanations stripped.                                                                                                                                                                                                                                       |
| `tests/`                              | Node-side tests (content pipeline) and `tests/fixtures/content` (synthetic fixtures, never shipped).                                                                                                                                                                                                                |
| `supabase/migrations/deca_00NN_*.sql` | DECA migrations, applied with ledger name `deca_00NN_*`. `fbla_*` objects are off limits.                                                                                                                                                                                                                           |

## Rules that hold everywhere

- **No fake functionality.** No demo players, seeded leaderboards, made-up counts or dead buttons. A page that is not
  built yet uses `PagePlaceholder` and says so; empty states say what is missing.
- **Content is sourced or a labelled placeholder.** No AI-written questions, vocab or role plays. Each question and
  term carries `source` (title, url, licence, attribution, adapted); the UI shows it, and `/credits` lists every
  source. Role-play files link to DECA's official samples only. `_archive*` folders never ship (the build refuses).
- **Answer keys stay on the server.** `public/content/exams/*.json` has no `answer` or `explanation`.
- **Owner access is decided by the database** (`public.is_platform_owner()`, keyed on `auth.uid()`); the UI only
  hides links.
- **localStorage is for per-device UI prefs only** (`src/lib/prefs.ts`, keys `deca-masters:pref:*`).
- **Look:** square corners everywhere (every Tailwind radius step is 0 in `tokens.css`); no purple
  gradients, no glass, no emoji icons; reduced motion respected; 44px touch targets; visible focus.
- DECA's diamond logo and trade dress are not used: they are reserved for chartered associations and chapters.

Built with love by Joseph & Kaden.
