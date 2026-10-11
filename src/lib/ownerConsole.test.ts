import { describe, expect, it } from "vitest";
import {
  auditActor,
  auditChange,
  dayLabel,
  loadPages,
  mergePage,
  seriesBars,
  signupFigure,
  type Count,
} from "./owner";

const n = (value: number): Count => ({ value, suppressed: false });
const hidden: Count = { value: null, suppressed: true };

describe("mergePage", () => {
  it("appends only rows it has not seen, and says how many were new", () => {
    expect(mergePage([{ id: 1 }, { id: 2 }], [{ id: 2 }, { id: 3 }], (r) => r.id)).toEqual({
      rows: [{ id: 1 }, { id: 2 }, { id: 3 }],
      added: 1,
    });
  });
});

describe("loadPages", () => {
  it("fetches pages until it has as many rows as were on screen, then stops", async () => {
    const all = Array.from({ length: 7 }, (_, i) => ({ id: i }));
    const asked: number[] = [];
    const fetchPage = async (offset: number) => {
      asked.push(offset);
      return { total: 7, rows: all.slice(offset, offset + 3) };
    };
    const out = await loadPages(fetchPage, 5, (r: { id: number }) => r.id);
    expect(asked).toEqual([0, 3]);
    expect(out.rows.map((r) => r.id)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(out.done).toBe(false);
  });

  it("stops when a page brings nothing new, so a shrinking list cannot loop", async () => {
    const out = await loadPages(async () => ({ total: 10, rows: [{ id: 1 }] }), 5, (r: { id: number }) => r.id);
    expect(out.rows).toEqual([{ id: 1 }]);
    expect(out.done).toBe(true);
  });
});

describe("seriesBars", () => {
  it("labels each bucket short for the axis and long for the table, and keeps hidden buckets as hidden", () => {
    const rows = [
      { start: "2026-10-05", end: "2026-10-11", active: n(12) },
      { start: "2026-10-12", end: "2026-10-18", active: hidden },
    ];
    expect(seriesBars(rows, "active", "week")).toEqual([
      { label: "Oct 5", title: "Oct 5 to Oct 11, 2026", value: 12, hidden: false },
      { label: "Oct 12", title: "Oct 12 to Oct 18, 2026", value: 0, hidden: true },
    ]);
  });
});

describe("signupFigure", () => {
  it("shows the finish rate with the counts behind it", () => {
    expect(signupFigure({ created: n(40), onboarded: n(30), rate: 0.75 }, "account")).toEqual({
      value: "75%",
      hidden: false,
      sub: "30 of 40",
    });
  });

  it("says Hidden when the finished count is withheld, and no rate when nobody signed up", () => {
    expect(signupFigure({ created: n(12), onboarded: hidden, rate: null }, "new account")).toEqual({
      value: "Hidden",
      hidden: true,
      sub: "12 new accounts",
    });
    expect(signupFigure({ created: n(0), onboarded: n(0), rate: null }, "account").sub).toBe(
      "No accounts yet",
    );
  });
});

describe("auditChange", () => {
  it("describes a triage change, an import and a retirement", () => {
    expect(
      auditChange("feedback_updated", { from: "new", to: "resolved", priority: "high", note_changed: true }),
    ).toBe("New to Resolved, high priority, note changed");
    expect(auditChange("feedback_updated", { from: "new", to: "new", priority: "normal", note_changed: false })).toBe(
      "",
    );
    expect(auditChange("content_imported", { kind: "exam", slug: "marketing", inserted: 3, updated: 1 })).toBe(
      "3 added, 1 replaced",
    );
    expect(auditChange("content_retired", { count: 1 }, "question")).toBe("1 question");
    expect(auditChange("content_restored", { count: 4 }, "term")).toBe("4 terms");
  });
});

describe("auditActor", () => {
  it("names the owner by username, and says when a change came from the database itself", () => {
    expect(auditActor({ actor_id: "u1", actor_username: "joseph" })).toBe("@joseph");
    expect(auditActor({ actor_id: "u1", actor_username: null })).toBe("An owner without a DECA profile");
    expect(auditActor({ actor_id: null, actor_username: null })).toBe("Database (no signed-in user)");
  });
});

describe("dayLabel", () => {
  const now = new Date("2026-10-11T16:00:00Z"); // noon in Toronto
  it("counts Toronto calendar days, and dates anything older than a month", () => {
    expect(dayLabel("2026-10-11", now)).toBe("Today");
    expect(dayLabel("2026-10-10", now)).toBe("Yesterday");
    expect(dayLabel("2026-10-01", now)).toBe("10 days ago");
    expect(dayLabel("2026-08-01", now)).toBe("Aug 1, 2026");
    expect(dayLabel(null, now)).toBe("Never");
  });
});
