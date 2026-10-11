// Ranking for the command palette. Pure and tested: the palette only renders what this returns.

export type Command = {
  id: string;
  label: string;
  group: string;
  /** Extra words that should find this command: an event code, a cluster, a synonym. */
  keywords?: string[];
  /** Shown on the right of the row (a route, a code, a shortcut). */
  hint?: string;
};

function isSubsequence(needle: string, hay: string): boolean {
  let at = 0;
  for (const ch of hay) {
    if (ch === needle[at]) at++;
    if (at === needle.length) return true;
  }
  return false;
}

/** Higher is better; 0 means no match. */
function score(query: string, c: Command): number {
  const label = c.label.toLowerCase();
  const keys = (c.keywords ?? []).map((k) => k.toLowerCase());
  if (label === query || keys.includes(query)) return 100;
  if (label.startsWith(query)) return 80;
  if (keys.some((k) => k.startsWith(query))) return 70;
  if (label.split(/[\s/,-]+/).some((w) => w.startsWith(query))) return 60;
  if (label.includes(query) || keys.some((k) => k.includes(query))) return 40;
  // Initials across words ("pom" finds "Principles of Marketing").
  const words = label.split(/[\s/,-]+/).filter(Boolean);
  if (query.length > 1 && words.map((w) => w[0]).join("").startsWith(query)) return 30;
  // Letters in order inside one word ("mkt" finds "Marketing"); never across words, which matches nearly anything.
  if (words.some((w) => isSubsequence(query, w))) return 20;
  return 0;
}

/** Commands that match `query`, best first; equal scores keep the order they were given in. */
export function rankCommands<T extends Command>(query: string, commands: T[]): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return commands.slice();
  return commands
    .map((c, i) => ({ c, i, s: score(q, c) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}
