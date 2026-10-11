import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { canMount3D } from "./webgl";

type Props = {
  /** `() => import("./HeroScene")`. The module's default export is the scene; it may import three, R3F, drei. */
  load: () => Promise<{ default: ComponentType }>;
  /** What shows when 3D is off (no WebGL, reduced motion, small screen), while the chunk loads, and off screen.
   *  Same size as the scene so nothing shifts. A static image or inline SVG of the same composition. */
  poster: ReactNode;
  /** Below this viewport width the poster shows instead (phones save battery and first load). */
  minWidth?: number;
  className?: string;
};

function wideEnough(minWidth: number): boolean {
  try {
    return window.matchMedia(`(min-width: ${minWidth}px)`).matches;
  } catch {
    return false;
  }
}

/**
 * The only way 3D enters a page. three.js never reaches the main bundle: the scene is a separate chunk, fetched only
 * when the browser can draw it, the visitor has not asked for reduced motion, the screen is wide enough and the
 * container is on screen. It unmounts again when scrolled away.
 */
export function Mount3D({
  load,
  poster,
  minWidth = 768,
  className = "",
}: Props) {
  const [Scene] = useState(() => lazy(load));
  const [allowed] = useState(() => canMount3D() && wideEnough(minWidth));
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!allowed || !box.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin: "200px" },
    );
    io.observe(box.current);
    return () => io.disconnect();
  }, [allowed]);

  return (
    <div ref={box} className={className}>
      {allowed && visible ? (
        <Suspense fallback={poster}>
          <Scene />
        </Suspense>
      ) : (
        poster
      )}
    </div>
  );
}
