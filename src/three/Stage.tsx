// The project's <Canvas> defaults. Import it only from a scene module that Mount3D loads, never from a page.
import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, type CanvasProps } from "@react-three/fiber";
import { useState } from "react";

type Props = CanvasProps & {
  /** Called when the device keeps failing to hold frame rate; swap to the poster then. */
  onFallback?: () => void;
  /** Ceiling for the pixel ratio (full tier 1.75, lite 1.4). */
  maxDpr?: number;
};

/**
 * - frameloop "demand" by default: nothing renders unless something changed (call invalidate() after manual
 *   changes). Pass frameloop="always" for a continuously animated scene, "never" to pause it.
 * - DPR starts at 1.5 (or the ceiling, if lower) and moves between 1 and the ceiling with measured performance.
 * - Transparent background: the page's own surface shows through, so light and dark themes both work.
 */
export function Stage({ children, onFallback, maxDpr = 2, ...rest }: Props) {
  const [dpr, setDpr] = useState(Math.min(1.5, maxDpr));
  return (
    <Canvas
      frameloop="demand"
      dpr={dpr}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      {...rest}
    >
      <PerformanceMonitor
        flipflops={3}
        onIncline={() => setDpr(maxDpr)}
        onDecline={() => setDpr(1)}
        onFallback={() => {
          setDpr(1);
          onFallback?.();
        }}
      >
        {children}
      </PerformanceMonitor>
    </Canvas>
  );
}
