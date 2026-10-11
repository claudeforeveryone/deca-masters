import { useCallback, useEffect, useState } from "react";
import {
  addBookmark,
  listBookmarks,
  removeBookmark,
} from "../../api/bookmarks";
import { ApiError } from "../../api/core";
import { MAX_MY_EVENTS, toggleMyEvent, type useMember } from "../../lib/member";

type Member = ReturnType<typeof useMember>;

/**
 * The member's two event lists: bookmarks (deca_bookmarks, kind "event") and "my events" (the profile's events, six at
 * most, the first is the main event). Both save to the server; a bookmark shows at once and rolls back if the save
 * fails. Every action throws ApiError with copy to show.
 */
export function useEventSaves(member: Member) {
  const ready = member.state.status === "ready";
  const uid = member.state.status === "ready" ? member.state.uid : null;
  const mine =
    member.state.status === "ready" ? member.state.profile.events : [];
  const [bookmarks, setBookmarks] = useState<Set<string>>(() => new Set());
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    if (!uid) {
      setBookmarks(new Set());
      setStatus("idle");
      return;
    }
    let live = true;
    setStatus("loading");
    listBookmarks("event")
      .then((rows) => {
        if (!live) return;
        setBookmarks(new Set(rows.map((r) => r.ref)));
        setStatus("ready");
      })
      .catch(() => live && setStatus("error"));
    return () => {
      live = false;
    };
  }, [uid]);

  const toggleBookmark = useCallback(
    async (code: string) => {
      const had = bookmarks.has(code);
      const flip = (on: boolean) =>
        setBookmarks((prev) => {
          const next = new Set(prev);
          if (on) next.add(code);
          else next.delete(code);
          return next;
        });
      flip(!had);
      try {
        if (had) await removeBookmark("event", code);
        else await addBookmark("event", code);
      } catch (e) {
        flip(had);
        throw e;
      }
      return !had;
    },
    [bookmarks],
  );

  const { setEvents } = member;
  const toggleMine = useCallback(
    async (code: string) => {
      const { events, full } = toggleMyEvent(mine, code);
      if (full)
        throw new ApiError(
          `You can keep ${MAX_MY_EVENTS} events. Remove one first.`,
        );
      await setEvents(events);
      return events.includes(code);
    },
    [mine, setEvents],
  );

  return {
    canSave: ready,
    bookmarks,
    bookmarksStatus: status,
    mine,
    toggleBookmark,
    toggleMine,
  };
}
