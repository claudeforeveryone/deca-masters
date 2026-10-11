// Saved items for the command centre: each bookmark (src/api/bookmarks.ts stores only kind + ref) turned into a title
// and a place to go. Questions and terms are looked up in one request each; events come from the catalogue the page
// already holds. A bookmark whose item was retired says so instead of disappearing.
import type { ExamSlug } from "../lib/content";
import { supabase } from "../lib/supabase";
import type { Bookmark, BookmarkKind } from "./bookmarks";
import { must } from "./core";
import { getQuestions } from "./questions";

export type SavedItem = {
  kind: BookmarkKind;
  ref: string;
  title: string;
  /** Where the item lives, or null when there is no page for it (a single question). */
  to: string | null;
  /** The exam a question belongs to, for context. */
  exam?: ExamSlug;
  note: string | null;
  created_at: string;
};

async function termTitles(
  ids: string[],
): Promise<Map<string, { term: string; deck: ExamSlug }>> {
  if (ids.length === 0) return new Map();
  const rows =
    must<{ id: string; term: string; deck: ExamSlug }[] | null>(
      await supabase
        .from("deca_vocab_terms")
        .select("id,term,deck")
        .in("id", ids),
      "Could not load your saved terms.",
    ) ?? [];
  return new Map(rows.map((r) => [r.id, { term: r.term, deck: r.deck }]));
}

export async function describeSaved(
  bookmarks: Bookmark[],
  events: { code: string; name: string }[],
): Promise<SavedItem[]> {
  const qIds = bookmarks.filter((b) => b.kind === "question").map((b) => b.ref);
  const tIds = bookmarks.filter((b) => b.kind === "term").map((b) => b.ref);
  const [questions, terms] = await Promise.all([
    qIds.length ? getQuestions(qIds) : Promise.resolve([]),
    termTitles(tIds),
  ]);
  const qById = new Map(questions.map((q) => [q.id, q]));
  const eventName = new Map(events.map((e) => [e.code, e.name]));

  return bookmarks.map((b) => {
    const base = {
      kind: b.kind,
      ref: b.ref,
      note: b.note,
      created_at: b.created_at,
    };
    switch (b.kind) {
      case "event": {
        const name = eventName.get(b.ref);
        return {
          ...base,
          title: name ? `${b.ref} ${name}` : b.ref,
          to: `/events/${encodeURIComponent(b.ref)}`,
        };
      }
      case "question": {
        const q = qById.get(b.ref);
        return q
          ? { ...base, title: q.stem, to: null, exam: q.exam }
          : {
              ...base,
              title: "A question that is no longer in the bank",
              to: null,
            };
      }
      case "term": {
        const t = terms.get(b.ref);
        return t
          ? {
              ...base,
              title: t.term,
              to: `/vocab/${encodeURIComponent(t.deck)}`,
            }
          : { ...base, title: "A term that is no longer in a deck", to: null };
      }
      case "scenario": {
        const [code, index] = b.ref.split("#");
        return {
          ...base,
          title:
            index === undefined
              ? `${code} role plays`
              : `${code} official sample ${Number(index) + 1}`,
          to: `/roleplay/${encodeURIComponent(code)}`,
        };
      }
    }
  });
}
