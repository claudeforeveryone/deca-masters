import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getEvent } from "../../api/events";
import {
  getRoleplayEvent,
  getSession,
  type RoleplayEvent,
  type RoleplaySession,
} from "../../api/roleplay";
import { useDocumentTitle } from "../../components/prep/useDocumentTitle";
import { RouteFallback } from "../../components/layout/RouteFallback";
import { buttonClass } from "../../components/ui/Button";
import { EmptyState, ErrorState } from "../../components/ui/EmptyState";
import { Notice } from "../../components/ui/Notice";
import type { EventItem } from "../../lib/content";
import { useMember } from "../../lib/member";
import { Trainer } from "./Trainer";

type Load =
  | { status: "loading" }
  | { status: "error" }
  | { status: "missing" }
  | { status: "no-roleplay"; event: EventItem }
  | { status: "ready"; event: EventItem; roleplay: RoleplayEvent };

type Active = {
  /** Remounts the trainer when it changes: a new session, or a saved one opened from the history. */
  key: string;
  id: string | null;
  session: RoleplaySession | null;
  status: "ready" | "loading" | "missing" | "error";
};

let fresh = 0;
const newActive = (): Active => ({
  key: `new-${++fresh}`,
  id: null,
  session: null,
  status: "ready",
});

/** /roleplay/:id, where :id is an event code. ?session=<id> opens one of the member's saved sessions. */
export function RoleplayDetailPage() {
  const { id = "" } = useParams();
  const code = id.toUpperCase();
  const [params, setParams] = useSearchParams();
  const requested = params.get("session");
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const member = useMember();
  const [active, setActive] = useState<Active>(newActive);
  const activeRef = useRef(active);
  activeRef.current = active;
  const [historyKey, setHistoryKey] = useState(0);

  useDocumentTitle(
    load.status === "ready" ? `${code} role-play trainer` : "Role-play trainer",
  );

  useEffect(() => {
    let live = true;
    setLoad({ status: "loading" });
    Promise.all([getEvent(code), getRoleplayEvent(code)])
      .then(([event, roleplay]) => {
        if (!live) return;
        if (!event) setLoad({ status: "missing" });
        else if (!roleplay) setLoad({ status: "no-roleplay", event });
        else setLoad({ status: "ready", event, roleplay });
      })
      .catch(() => live && setLoad({ status: "error" }));
    return () => {
      live = false;
    };
  }, [code, attempt]);

  // Open the session named in the URL, unless it is the one the trainer already holds (its own first save).
  const memberReady = member.state.status === "ready";
  useEffect(() => {
    if (!requested) {
      if (activeRef.current.id !== null) setActive(newActive());
      return;
    }
    if (requested === activeRef.current.id) return;
    if (!memberReady) return;
    let live = true;
    setActive({
      key: `s-${requested}`,
      id: requested,
      session: null,
      status: "loading",
    });
    getSession(requested)
      .then((s) => {
        if (!live) return;
        if (!s || s.event_code !== code)
          setActive({
            key: `s-${requested}`,
            id: requested,
            session: null,
            status: "missing",
          });
        else
          setActive({
            key: `s-${requested}`,
            id: s.id,
            session: s,
            status: "ready",
          });
      })
      .catch(
        () =>
          live &&
          setActive({
            key: `s-${requested}`,
            id: requested,
            session: null,
            status: "error",
          }),
      );
    return () => {
      live = false;
    };
  }, [requested, memberReady, code]);

  function startNew() {
    setActive(newActive());
    setParams({}, { replace: false });
  }

  function onSaved(s: RoleplaySession) {
    setHistoryKey((n) => n + 1);
    if (activeRef.current.id !== s.id) {
      // Adopt the id first so the URL change below does not reload the trainer.
      setActive((a) => ({ ...a, id: s.id, session: s }));
      activeRef.current = { ...activeRef.current, id: s.id };
      setParams({ session: s.id }, { replace: true });
    }
  }

  if (load.status === "loading")
    return <RouteFallback label="Loading the trainer" />;
  if (load.status === "error")
    return (
      <ErrorState
        headingLevel={1}
        title="The trainer did not load"
        body="Check your connection, then try again."
        onRetry={() => setAttempt((n) => n + 1)}
      />
    );
  if (load.status === "missing")
    return (
      <EmptyState
        headingLevel={1}
        title="No event with that code"
        body={
          <>
            <span className="font-mono">{code}</span> is not a published high
            school event.
          </>
        }
        action={
          <Link to="/roleplay" className={buttonClass("secondary")}>
            All role-play events
          </Link>
        }
      />
    );
  if (load.status === "no-roleplay")
    return (
      <EmptyState
        headingLevel={1}
        title={`${load.event.code} has no role play`}
        body={`${load.event.name} has no role play or case study, so there is nothing to time here. Its event page says what it involves.`}
        action={
          <>
            <Link
              to={`/events/${load.event.code}`}
              className={buttonClass("secondary")}
            >
              {load.event.code} event page
            </Link>
            <Link to="/roleplay" className={buttonClass("quiet")}>
              All role-play events
            </Link>
          </>
        }
      />
    );

  if (
    active.status === "loading" ||
    (requested && requested !== active.id && member.state.status === "loading")
  )
    return <RouteFallback label="Opening your session" />;

  return (
    <>
      {active.status === "missing" || active.status === "error" ? (
        <div className="mb-6">
          <Notice tone={active.status === "error" ? "error" : "warn"}>
            {active.status === "error"
              ? "That session did not load. Check your connection and reload the page."
              : "That session is not in your history. It may have been deleted."}{" "}
            <button
              type="button"
              onClick={startNew}
              className="font-semibold text-link underline underline-offset-4"
            >
              Start a new session
            </button>
          </Notice>
        </div>
      ) : null}
      {requested && !memberReady && member.state.status !== "loading" ? (
        <div className="mb-6">
          <Notice tone="info">
            Sign in to open a saved session. A new session is ready below.
          </Notice>
        </div>
      ) : null}
      <Trainer
        key={active.key}
        event={load.event}
        roleplay={load.roleplay}
        saved={active.status === "ready" ? active.session : null}
        member={member}
        onSaved={onSaved}
        onNewSession={startNew}
        historyKey={historyKey}
        onHistoryDeleted={(id) => {
          if (id === activeRef.current.id) startNew();
        }}
      />
    </>
  );
}
