import { useEffect, useReducer, useRef, useState } from "react";
import {
  clockReducer,
  createClock,
  remaining,
  type ClockAction,
  type ClockPhase,
  type TrainerClock,
} from "./trainerClock";

/**
 * Runs the trainer clock: wall-clock ticks (measured, so a throttled background tab still counts real time) and one
 * spoken line for each moment that matters: prep over, one minute left, time.
 */
export function useTrainerClock(phases: ClockPhase[], initial?: TrainerClock) {
  const [clock, dispatch] = useReducer(
    clockReducer,
    phases,
    (p) => initial ?? createClock(p),
  );
  const last = useRef(0);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (!clock.running) return;
    last.current = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      dispatch({ type: "tick", seconds: (now - last.current) / 1000 });
      last.current = now;
    }, 250);
    return () => window.clearInterval(id);
  }, [clock.running]);

  // Phase changes and the last minute, announced once each, only as they happen (a restored session stays quiet).
  const left = remaining(clock);
  const lastMinute = clock.running && left <= 60 && left > 0;
  const prev = useRef(clock.status);
  useEffect(() => {
    const was = prev.current;
    prev.current = clock.status;
    if (was === clock.status) return;
    if (clock.status === "between")
      setAnnouncement("Prep is over. Start the judge's clock when you walk in.");
    else if (clock.status === "done" && (was === "running" || was === "paused" || was === "between"))
      setAnnouncement("Time.");
  }, [clock.status]);
  useEffect(() => {
    if (lastMinute) setAnnouncement("One minute left.");
  }, [lastMinute]);

  const send = (a: ClockAction) => {
    if (a.type === "reset") setAnnouncement("");
    dispatch(a);
  };

  return { clock, dispatch: send, announcement, lastMinute };
}
