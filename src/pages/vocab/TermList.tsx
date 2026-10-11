import { useMemo, useState } from "react";
import { Select, SearchField } from "../../components/ui/Inputs";
import { Tag } from "../../components/ui/Tag";
import type { VocabTerm } from "../../lib/content";
import { Credit } from "./parts";
import { STATUS_LABEL, termStatus } from "./study";
import type { DeckProgress } from "./useDeckProgress";

/** Every term in the deck with its definition, area, your status and its source. */
export function TermList({
  terms,
  progress,
  showStatus,
}: {
  terms: VocabTerm[];
  progress: DeckProgress;
  showStatus: boolean;
}) {
  const [q, setQ] = useState("");
  const [area, setArea] = useState("");
  const areas = useMemo(
    () => [...new Set(terms.map((t) => t.area))].sort(),
    [terms],
  );
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = terms.filter(
    (t) =>
      (!area || t.area === area) &&
      words.every((w) => `${t.term} ${t.definition}`.toLowerCase().includes(w)),
  );
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_16rem] sm:items-end">
        <SearchField
          label="Search terms"
          labelHidden
          placeholder="Search terms and definitions"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
        />
        <Select
          label="Instructional area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          options={[
            { value: "", label: "Every area" },
            ...areas.map((a) => ({ value: a, label: a })),
          ]}
        />
      </div>
      <p aria-live="polite" className="text-sm text-ink-2">
        <span className="font-mono tabular-nums">{shown.length}</span> of{" "}
        <span className="font-mono tabular-nums">{terms.length}</span> terms
      </p>
      {shown.length ? (
        <dl className="border-t border-line">
          {shown.map((t) => {
            const st = termStatus(progress.reviews.get(t.id));
            return (
              <div key={t.id} className="grid gap-1 border-b border-line py-4">
                <dt className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-display text-xl font-bold text-ink">
                    {t.term}
                  </span>
                  {showStatus ? (
                    <Tag
                      tone={
                        st === "mastered"
                          ? "good"
                          : st === "new"
                            ? "neutral"
                            : "accent"
                      }
                    >
                      {STATUS_LABEL[st]}
                    </Tag>
                  ) : null}
                </dt>
                <dd className="max-w-(--measure) text-ink">{t.definition}</dd>
                <dd className="text-sm text-ink-3">{t.area}</dd>
                <dd>
                  <Credit source={t.source} />
                </dd>
              </div>
            );
          })}
        </dl>
      ) : (
        <p className="text-ink-2">No terms match. Try another word or area.</p>
      )}
    </div>
  );
}
