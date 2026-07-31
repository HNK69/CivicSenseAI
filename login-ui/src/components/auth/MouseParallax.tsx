import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";

type Ctx = { x: MotionValue<number>; y: MotionValue<number> };

const ParallaxContext = createContext<Ctx | null>(null);

/** Provides normalized (-0.5 .. 0.5) smoothed pointer position to children. */
export function MouseParallaxProvider({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.6 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduce) return;
    const onMove = (e: PointerEvent) => {
      rawX.set(e.clientX / window.innerWidth - 0.5);
      rawY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [rawX, rawY, reduce]);

  return (
    <ParallaxContext.Provider value={{ x, y }}>
      <div ref={ref} className="contents">
        {children}
      </div>
    </ParallaxContext.Provider>
  );
}

export function useParallax(depth = 20) {
  const ctx = useContext(ParallaxContext);
  const fallback = useMotionValue(0);
  const sx = ctx?.x ?? fallback;
  const sy = ctx?.y ?? fallback;
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth);
  return { x, y };
}

/** Wraps children in a layer that drifts with the pointer at a given depth. */
export function ParallaxLayer({
  depth = 20,
  className,
  children,
}: {
  depth?: number;
  className?: string;
  children?: ReactNode;
}) {
  const { x, y } = useParallax(depth);
  return (
    <motion.div style={{ x, y }} className={className} aria-hidden="true">
      {children}
    </motion.div>
  );
}
