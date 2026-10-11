import { BarList, LineChart } from "../../../components/ui/charts/Charts";
import { StatRow, StatTile } from "../../../components/ui/Navigation";
import type { ContentIndex } from "../../../lib/content";
import { AppWindow } from "./AppWindow";

// Made-up numbers that show what the page draws once you have runs. The tag on the window says so.
const RUNS = [54, 58, 61, 60, 66, 70, 69, 74].map((y, i) => ({
  x: `Run ${i + 1}`,
  y,
}));
const WEAK = [41, 48, 55];

export function ProgressPreview({ index }: { index: ContentIndex | null }) {
  const exam =
    index?.exams.find((e) => e.slug === "marketing" && e.areas.length) ??
    index?.exams.find((e) => e.areas.length);
  const weakest = exam
    ? [...exam.areas]
        .sort((a, b) => b.count - a.count)
        .slice(2, 5)
        .map((a, i) => ({ label: a.name, value: WEAK[i] }))
    : [];

  return (
    <AppWindow path="/progress" note="Illustrative values">
      <StatRow>
        <StatTile label="Runs" value="8" />
        <StatTile label="Average" value="64" unit="%" />
        <StatTile
          label="Last run"
          value="74"
          unit="%"
          delta={{ value: "5 points", direction: "up", good: true }}
        />
      </StatRow>
      <div className="mt-5">
        <LineChart
          label="Score per run"
          description="Eight practice runs, scores rising from 54 to 74 percent. Illustrative values."
          data={RUNS}
          yMin={40}
          yMax={100}
          height={180}
          format={(n) => `${n}%`}
        />
      </div>
      {weakest.length ? (
        <div className="mt-5 border-t border-line pt-5">
          <p className="mb-3 text-sm font-semibold">Work on these next</p>
          <BarList
            label="Lowest instructional areas, percent correct"
            data={weakest}
            max={100}
            format={(n) => `${n}%`}
          />
        </div>
      ) : null}
    </AppWindow>
  );
}
