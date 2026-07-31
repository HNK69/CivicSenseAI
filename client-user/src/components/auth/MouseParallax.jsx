import { createContext, useContext, useEffect } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';

const ParallaxContext = createContext(null);

/** Provides normalized (-0.5 .. 0.5) smoothed pointer position to children. */
export function MouseParallaxProvider({ children }) {
  const rawX = useMotionValue(0);
  const rawY = useMotionValue(0);
  const x = useSpring(rawX, { stiffness: 60, damping: 20, mass: 0.6 });
  const y = useSpring(rawY, { stiffness: 60, damping: 20, mass: 0.6 });

  useEffect(() => {
    const onMove = (e) => {
      rawX.set(e.clientX / window.innerWidth - 0.5);
      rawY.set(e.clientY / window.innerHeight - 0.5);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [rawX, rawY]);

  return (
    <ParallaxContext.Provider value={{ x, y }}>
      <div className="auth-parallax-root">{children}</div>
    </ParallaxContext.Provider>
  );
}

export function useParallax(depth = 20) {
  const ctx = useContext(ParallaxContext);
  const fallbackX = useMotionValue(0);
  const fallbackY = useMotionValue(0);
  const sx = ctx?.x ?? fallbackX;
  const sy = ctx?.y ?? fallbackY;
  const x = useTransform(sx, (v) => v * depth);
  const y = useTransform(sy, (v) => v * depth);
  return { x, y };
}

/** Wraps children in a layer that drifts with the pointer at a given depth. */
export function ParallaxLayer({ depth = 20, className, children }) {
  const { x, y } = useParallax(depth);
  return (
    <motion.div style={{ x, y }} className={className} aria-hidden="true">
      {children}
    </motion.div>
  );
}
