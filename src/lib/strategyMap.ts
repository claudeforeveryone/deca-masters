// The Strategy Map's data: your events, the prep tracks each one uses on this site (its cluster exam, that exam's
// vocab deck, the role-play trainer), and the exam's instructional areas, each carrying your real activity. One
// graph drives both the drawn map and its list view, so the two can never disagree. Links come only from the
// catalogue (an event's exam, the trainer's event list); nothing is inferred.
import type { ClusterSlug, EventComponent } from "./content";

export type MapInput = {
  /** The member's events in profile order. */
  events: {
    code: string;
    name: string;
    cluster: ClusterSlug;
    exam: string | null;
    components: EventComponent[];
  }[];
  /** Event codes the role-play trainer covers. */
  roleplayEvents: string[];
  bank: {
    exam: string;
    title: string;
    cluster: string;
    status: "sourced" | "placeholder";
    questions: number;
    areas: { area: string; questions: number }[];
  }[];
  /** Graded answers per exam and area (deca_weak_spots). */
  weak: { exam: string; area: string; answered: number; correct: number }[];
  /** Graded answers with their question (any order, repeats allowed): distinct questions seen. */
  seen: { exam: string; area: string; question_id: string }[];
  vocab: {
    deck: string;
    title: string;
    terms: number;
    seen: number;
    mastered: number;
    due: number;
  }[];
  roleplay: {
    event_code: string;
    sessions: number;
    last_at: string;
    avg_level: number | null;
  }[];
};

type Activity = {
  /** Graded answers. */
  answered: number;
  correct: number;
  /** Distinct questions answered. */
  seen: number;
  /** Active questions in the bank. */
  questions: number;
};

export type EventNode = {
  id: string;
  kind: "event";
  code: string;
  name: string;
  cluster: ClusterSlug;
  main: boolean;
  components: EventComponent[];
};
export type ExamNode = Activity & {
  id: string;
  kind: "exam";
  exam: string;
  title: string;
  status: "sourced" | "placeholder" | null;
  /** Practised, but none of your events uses this exam. */
  outside: boolean;
};
export type DeckNode = {
  id: string;
  kind: "deck";
  deck: string;
  title: string;
  terms: number;
  seen: number;
  mastered: number;
  due: number;
};
export type TrainerNode = {
  id: string;
  kind: "roleplay";
  code: string;
  sessions: number;
  lastAt: string | null;
  avgLevel: number | null;
};
export type AreaNode = Activity & {
  id: string;
  kind: "area";
  exam: string;
  area: string;
};
export type MapNode = EventNode | ExamNode | DeckNode | TrainerNode | AreaNode;

export type StrategyMap = {
  nodes: Map<string, MapNode>;
  /** [from, to]: event -> track, exam -> area. */
  edges: [string, string][];
  columns: { events: string[]; tracks: string[]; areas: string[] };
};

export type AreaState = "untouched" | "thin" | "weak" | "steady" | "strong";

/** Five graded answers before an area is called weak or strong; under 70% is weak, 85% and up is strong. */
export const MIN_SAMPLE = 5;
export function areaState(a: { answered: number; correct: number }): AreaState {
  if (a.answered === 0) return "untouched";
  if (a.answered < MIN_SAMPLE) return "thin";
  const acc = a.correct / a.answered;
  return acc < 0.7 ? "weak" : acc >= 0.85 ? "strong" : "steady";
}

const areaId = (exam: string, area: string) => `area:${exam}:${area}`;

export function buildStrategyMap(input: MapInput): StrategyMap {
  const nodes = new Map<string, MapNode>();
  const edges: [string, string][] = [];
  const columns = {
    events: [] as string[],
    tracks: [] as string[],
    areas: [] as string[],
  };
  const bank = new Map(input.bank.map((b) => [b.exam, b]));
  const vocab = new Map(input.vocab.map((v) => [v.deck, v]));
  const trainer = new Map(input.roleplay.map((r) => [r.event_code, r]));
  const roleplayEvents = new Set(input.roleplayEvents);

  // graded answers and distinct questions, per exam and per area
  const answered = new Map<string, { answered: number; correct: number }>();
  for (const w of input.weak) {
    for (const key of [w.exam, areaId(w.exam, w.area)]) {
      const cur = answered.get(key) ?? { answered: 0, correct: 0 };
      cur.answered += w.answered;
      cur.correct += w.correct;
      answered.set(key, cur);
    }
  }
  const seen = new Map<string, Set<string>>();
  for (const s of input.seen)
    for (const key of [s.exam, areaId(s.exam, s.area)]) {
      if (!seen.has(key)) seen.set(key, new Set());
      seen.get(key)!.add(s.question_id);
    }
  const activity = (key: string, questions: number): Activity => ({
    answered: answered.get(key)?.answered ?? 0,
    correct: answered.get(key)?.correct ?? 0,
    seen: seen.get(key)?.size ?? 0,
    questions,
  });

  function addTrack(node: MapNode) {
    if (nodes.has(node.id)) return;
    nodes.set(node.id, node);
    columns.tracks.push(node.id);
  }
  function addExam(exam: string, outside: boolean) {
    const b = bank.get(exam);
    addTrack({
      id: `exam:${exam}`,
      kind: "exam",
      exam,
      title: b?.title ?? exam,
      status: b?.status ?? null,
      outside,
      ...activity(exam, b?.questions ?? 0),
    });
  }

  input.events.forEach((e, i) => {
    const id = `event:${e.code}`;
    nodes.set(id, {
      id,
      kind: "event",
      code: e.code,
      name: e.name,
      cluster: e.cluster,
      main: i === 0,
      components: e.components,
    });
    columns.events.push(id);
    if (e.exam) {
      addExam(e.exam, false);
      edges.push([id, `exam:${e.exam}`]);
      const deck = vocab.get(e.exam);
      if (deck) {
        addTrack({
          id: `deck:${e.exam}`,
          kind: "deck",
          deck: deck.deck,
          title: deck.title,
          terms: deck.terms,
          seen: deck.seen,
          mastered: deck.mastered,
          due: deck.due,
        });
        edges.push([id, `deck:${e.exam}`]);
      }
    }
    if (roleplayEvents.has(e.code)) {
      const t = trainer.get(e.code);
      addTrack({
        id: `roleplay:${e.code}`,
        kind: "roleplay",
        code: e.code,
        sessions: t?.sessions ?? 0,
        lastAt: t?.last_at ?? null,
        avgLevel: t?.avg_level ?? null,
      });
      edges.push([id, `roleplay:${e.code}`]);
    }
  });

  // exams practised that none of the events uses
  for (const w of input.weak)
    if (!nodes.has(`exam:${w.exam}`)) addExam(w.exam, true);

  for (const trackId of columns.tracks) {
    const exam = nodes.get(trackId);
    if (exam?.kind !== "exam") continue;
    const names = new Set<string>([
      ...(bank.get(exam.exam)?.areas.map((a) => a.area) ?? []),
      ...input.weak.filter((w) => w.exam === exam.exam).map((w) => w.area),
    ]);
    const counts = new Map(
      (bank.get(exam.exam)?.areas ?? []).map((a) => [a.area, a.questions]),
    );
    for (const area of [...names].sort((a, b) => a.localeCompare(b))) {
      const id = areaId(exam.exam, area);
      nodes.set(id, {
        id,
        kind: "area",
        exam: exam.exam,
        area,
        ...activity(id, counts.get(area) ?? 0),
      });
      columns.areas.push(id);
      edges.push([exam.id, id]);
    }
  }

  return { nodes, edges, columns };
}

/** The nodes to light up when `id` is selected: its direct links, plus an event's areas or an area's events. */
export function linkedTo(map: StrategyMap, id: string): Set<string> {
  const out = new Set<string>([id]);
  const node = map.nodes.get(id);
  if (!node) return out;
  for (const [a, b] of map.edges) {
    if (a === id) out.add(b);
    if (b === id) out.add(a);
  }
  if (node.kind === "event")
    for (const [a, b] of map.edges)
      if (out.has(a) && map.nodes.get(a)?.kind === "exam") out.add(b);
  if (node.kind === "area") {
    const exam = `exam:${node.exam}`;
    for (const [a, b] of map.edges) if (b === exam) out.add(a);
  }
  return out;
}
