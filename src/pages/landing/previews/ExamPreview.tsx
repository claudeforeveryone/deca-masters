import { BarList } from "../../../components/ui/charts/Charts";
import { ProgressRing } from "../../../components/ui/Progress";
import type { ContentIndex } from "../../../lib/content";
import { AppWindow } from "./AppWindow";

// Made-up results to show the layout. The area names are the real ones from the published question bank.
const SHARE = [0.86, 0.75, 0.62, 0.5, 0.4];

export function ExamPreview({ index }: { index: ContentIndex | null }) {
  const exam =
    index?.exams.find((e) => e.slug === "marketing" && e.areas.length) ??
    index?.exams.find((e) => e.areas.length);
  const areas = exam
    ? [...exam.areas]
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)
        .map((a, i) => ({
          label: a.name,
          value: Math.round(SHARE[i] * 100),
        }))
    : [];

  return (
    <AppWindow path="/practice/review" note="Illustrative values">
      <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
        <ProgressRing
          value={41}
          max={50}
          size={128}
          label="Score"
          valueText="41 of 50 correct"
        >
          <span>
            <span className="block font-mono text-3xl font-semibold tabular-nums">
              82%
            </span>
            <span className="block text-xs text-ink-2">41 of 50</span>
          </span>
        </ProgressRing>
        <div>
          <p className="font-display text-title font-bold">
            {exam?.title ?? "Marketing cluster exam"}
          </p>
          <p className="mt-2 max-w-[44ch] text-sm text-ink-2">
            Timed run, finished. Every question you missed is waiting in
            review, with the right answer and the source it came from.
          </p>
        </div>
      </div>
      {areas.length ? (
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-sm font-semibold">
            By instructional area, percent correct
          </p>
          <BarList
            label="Percent correct by instructional area"
            data={areas}
            max={100}
            format={(n) => `${n}%`}
          />
        </div>
      ) : null}
    </AppWindow>
  );
}
