import {
  Component,
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { readDevice, tierFor, type Tier } from "./tier";

/** What every scene receives from Mount3D on top of its own props. */
export type SceneControl = {
  /** "lite" drops the expensive extras (particles, high pixel ratio). */
  tier: Exclude<Tier, "poster">;
  /** False while the canvas is off screen or the tab is hidden: render nothing (frameloop "never"). */
  active: boolean;
  /** The scene drew its first frame: the canvas fades in over the poster. */
  onReady: () => void;
  /** The device cannot hold frame rate: go back to the poster for good. */
  onFallback: () => void;
};

type Props<P> = {
  /** `() => import("./StrategyUniverse")`. The module's default export is the scene; it may import three, R3F. */
  load: () => Promise<{ default: ComponentType<P & SceneControl> }>;
  /** The scene's own props (variant, selection...). */
  props: P;
  /** Shown when 3D is off (no WebGL, reduced motion, phone width, software renderer), while the chunk loads, and if
   *  the scene fails. Same size as the scene so nothing shifts: a computed SVG frame of the same composition. */
  poster: ReactNode;
  className?: string;
  /** Wait for the page's load event and an idle slot before fetching the 3D chunk, so it never competes with first
   *  paint (default true). */
  defer?: boolean;
};

/** Contains a failed chunk or a scene that throws: the poster stays and the page keeps working. */
class SceneBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.warn(
      "[3D] scene failed, showing the poster instead",
      error.message,
    );
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function afterLoadAndIdle(run: () => void): () => void {
  let cancelled = false;
  let idleId: number | undefined;
  let timer: number | undefined;
  const w = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number },
    ) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  const schedule = () => {
    if (cancelled) return;
    if (w.requestIdleCallback)
      idleId = w.requestIdleCallback(() => !cancelled && run(), {
        timeout: 2000,
      });
    else timer = window.setTimeout(() => !cancelled && run(), 300);
  };
  if (document.readyState === "complete") schedule();
  else window.addEventListener("load", schedule, { once: true });
  return () => {
    cancelled = true;
    window.removeEventListener("load", schedule);
    if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
    if (timer !== undefined) window.clearTimeout(timer);
  };
}

/**
 * The only way 3D enters a page. three.js never reaches the main bundle: the scene is a separate chunk, fetched only
 * when the device tier allows it (WebGL, no reduced motion, wide enough, hardware renderer), after first paint, and
 * when the container is near the viewport. Off screen or in a hidden tab the scene is paused; scrolled far away it
 * unmounts and releases the GPU. The poster sits underneath the whole time.
 */
export function Mount3D<P extends object>({
  load,
  props,
  poster,
  className = "",
  defer = true,
}: Props<P>) {
  const [Scene] = useState(() => lazy(load));
  const [tier] = useState<Tier>(() => {
    try {
      return tierFor(readDevice());
    } catch {
      return "poster";
    }
  });
  const [cleared, setCleared] = useState(!defer);
  const [near, setNear] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  const [pageVisible, setPageVisible] = useState(
    typeof document === "undefined" || document.visibilityState !== "hidden",
  );
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const allowed = tier !== "poster" && !failed;

  useEffect(() => {
    if (!allowed || cleared) return;
    return afterLoadAndIdle(() => setCleared(true));
  }, [allowed, cleared]);

  useEffect(() => {
    if (!allowed || !box.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      setOnScreen(true);
      return;
    }
    const nearIo = new IntersectionObserver(
      ([e]) => setNear(e.isIntersecting),
      { rootMargin: "200px" },
    );
    const seenIo = new IntersectionObserver(([e]) =>
      setOnScreen(e.isIntersecting),
    );
    nearIo.observe(box.current);
    seenIo.observe(box.current);
    return () => {
      nearIo.disconnect();
      seenIo.disconnect();
    };
  }, [allowed]);

  useEffect(() => {
    const onVis = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // A remount (scrolled back into range) fades in again.
  useEffect(() => {
    if (!near) setReady(false);
  }, [near]);

  const mounted = allowed && cleared && near;

  return (
    <div ref={box} className={`relative ${className}`}>
      <div
        aria-hidden="true"
        className={`absolute inset-0 transition-opacity duration-(--dur-4) ease-out ${mounted && ready ? "opacity-0" : "opacity-100"}`}
      >
        {poster}
      </div>
      {mounted ? (
        <div
          aria-hidden="true"
          className={`absolute inset-0 transition-opacity duration-(--dur-4) ease-out ${ready ? "opacity-100" : "opacity-0"}`}
        >
          <SceneBoundary onError={() => setFailed(true)}>
            <Suspense fallback={null}>
              <Scene
                {...props}
                tier={tier as Exclude<Tier, "poster">}
                active={onScreen && pageVisible}
                onReady={() => setReady(true)}
                onFallback={() => setFailed(true)}
              />
            </Suspense>
          </SceneBoundary>
        </div>
      ) : null}
    </div>
  );
}
