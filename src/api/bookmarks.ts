// Bookmarks (public.deca_bookmarks, deca_0004_study.sql): plain rows the member owns (RLS). A bookmark points at an
// event code, a question id, a vocab term id, or a role-play event with an optional sample index ("PMK#2"). The
// server checks the target exists, allows 500 per member and lets only the note change afterwards.
import { supabase } from "../lib/supabase";
import { must, toApiError } from "./core";

export type BookmarkKind = "event" | "question" | "term" | "scenario";

export type Bookmark = {
  kind: BookmarkKind;
  ref: string;
  note: string | null;
  created_at: string;
};

/** Notes are at most 280 characters. */
export const NOTE_MAX = 280;

const clean = (note: string | null | undefined) => note?.trim() || null;

/** A scenario bookmark's ref: the role-play event, or one of its official samples (0-based index). */
export function scenarioRef(eventCode: string, sampleIndex?: number): string {
  return sampleIndex === undefined ? eventCode : `${eventCode}#${sampleIndex}`;
}

/** The caller's bookmarks, newest first; one kind when given. */
export async function listBookmarks(kind?: BookmarkKind): Promise<Bookmark[]> {
  let q = supabase.from("deca_bookmarks").select("kind,ref,note,created_at");
  if (kind) q = q.eq("kind", kind);
  return (
    must<Bookmark[] | null>(
      await q.order("created_at", { ascending: false }),
      "Could not load your bookmarks.",
    ) ?? []
  );
}

/** Saves a bookmark. Saving one that already exists is not an error (it stays as it was). */
export async function addBookmark(
  kind: BookmarkKind,
  ref: string,
  note?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("deca_bookmarks")
    .insert({ kind, ref, note: clean(note) });
  if (error && error.code !== "23505")
    throw toApiError(error, "Could not save the bookmark.");
}

/** Changes a bookmark's note ('' removes it). */
export async function setBookmarkNote(
  kind: BookmarkKind,
  ref: string,
  note: string,
): Promise<void> {
  must(
    await supabase
      .from("deca_bookmarks")
      .update({ note: clean(note) })
      .eq("kind", kind)
      .eq("ref", ref),
    "Could not save the note.",
  );
}

export async function removeBookmark(
  kind: BookmarkKind,
  ref: string,
): Promise<void> {
  must(
    await supabase
      .from("deca_bookmarks")
      .delete()
      .eq("kind", kind)
      .eq("ref", ref),
    "Could not remove the bookmark.",
  );
}
