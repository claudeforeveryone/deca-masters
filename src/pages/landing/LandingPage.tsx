import { useMemo } from "react";
import { ClusterExplorer } from "./ClusterExplorer";
import { Closing } from "./Closing";
import { eventsByCluster, ringTicks } from "./data";
import { FormatBoard } from "./FormatBoard";
import { Hero } from "./Hero";
import { ToolsShowcase } from "./ToolsShowcase";
import { SECTORS } from "./universe/geometry";
import { useContentIndex } from "./useContentIndex";

/**
 * The signed-out landing. One content index feeds every section: the format board, the cluster explorer, the tool
 * previews and the ring of ticks around the structure (one per published event). With nothing published, each
 * section says so instead of inventing numbers.
 */
export function LandingPage() {
  const state = useContentIndex();
  const ticks = useMemo(() => {
    if (state.status !== "ready") return [];
    const by = eventsByCluster(state.index.events);
    return ringTicks(SECTORS.map((s) => by[s].length));
  }, [state]);

  return (
    <>
      <Hero ticks={ticks} />
      <FormatBoard state={state} />
      <ClusterExplorer state={state} ticks={ticks} />
      <ToolsShowcase state={state} />
      <Closing ticks={ticks} />
    </>
  );
}
