import { motion, useReducedMotion } from "motion/react";
import { AnimatedGrid } from "./AnimatedGrid";
import { FloatingParticles } from "./FloatingParticles";
import { ParallaxLayer } from "./MouseParallax";

/** Composed depth stack: mesh, grid, beams, circles, particles, noise. */
export function BackgroundEffects() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* mesh gradient blobs — slowest layer */}
      <ParallaxLayer depth={14} className="absolute inset-0">
        <motion.div
          className="absolute -left-[15%] top-[-10%] h-[46rem] w-[46rem] rounded-full blur-3xl"
          style={{ background: "var(--mesh-blue)" }}
          animate={reduce ? undefined : { x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-20%] left-[25%] h-[38rem] w-[38rem] rounded-full blur-3xl"
          style={{ background: "var(--mesh-emerald)" }}
          animate={reduce ? undefined : { x: [0, -50, 0], y: [0, -30, 0], scale: [1.05, 1, 1.05] }}
          transition={{ duration: 42, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute right-[-10%] top-[30%] h-[32rem] w-[32rem] rounded-full blur-3xl"
          style={{ background: "var(--mesh-warm)" }}
          animate={reduce ? undefined : { x: [0, -40, 0], y: [0, 50, 0] }}
          transition={{ duration: 50, repeat: Infinity, ease: "easeInOut" }}
        />
      </ParallaxLayer>

      {/* grid */}
      <ParallaxLayer depth={26} className="absolute inset-0">
        <AnimatedGrid />
      </ParallaxLayer>

      {/* light beams */}
      <ParallaxLayer depth={40} className="absolute inset-0">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute top-[-30%] h-[160%] w-[14rem] -rotate-12"
            style={{
              left: `${8 + i * 26}%`,
              background:
                "linear-gradient(to bottom, transparent, var(--beam), transparent)",
            }}
            animate={reduce ? { opacity: 0.4 } : { opacity: [0, 0.75, 0], x: [-40, 60, -40] }}
            transition={{ duration: 22 + i * 7, repeat: Infinity, ease: "easeInOut", delay: i * 4 }}
          />
        ))}
      </ParallaxLayer>

      {/* parallax outline circles */}
      <ParallaxLayer depth={64} className="absolute inset-0">
        {[
          { size: 620, left: "6%", top: "12%" },
          { size: 380, left: "48%", top: "52%" },
          { size: 240, left: "30%", top: "72%" },
        ].map((c, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: c.size,
              height: c.size,
              left: c.left,
              top: c.top,
              borderColor: "var(--ring-faint)",
            }}
            animate={reduce ? undefined : { scale: [1, 1.04, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 18 + i * 6, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </ParallaxLayer>

      {/* particles + connective lines */}
      <ParallaxLayer depth={90} className="absolute inset-0">
        <FloatingParticles />
      </ParallaxLayer>

      {/* noise texture */}
      <div className="noise-overlay absolute inset-0" />
    </div>
  );
}
