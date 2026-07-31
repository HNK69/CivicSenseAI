import { motion, useReducedMotion } from "motion/react";

/** Slowly breathing blueprint grid with a soft radial mask. */
export function AnimatedGrid({ className = "" }: { className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      aria-hidden="true"
      className={`absolute inset-0 ${className}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.6 }}
      style={{
        backgroundImage:
          "linear-gradient(to right, var(--grid-line) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        maskImage:
          "radial-gradient(ellipse 90% 70% at 30% 40%, black 20%, transparent 78%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 90% 70% at 30% 40%, black 20%, transparent 78%)",
      }}
    >
      {!reduce && (
        <motion.div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, var(--grid-line-strong) 1px, transparent 1px), linear-gradient(to bottom, var(--grid-line-strong) 1px, transparent 1px)",
            backgroundSize: "288px 288px",
          }}
          animate={{ backgroundPositionX: ["0px", "288px"] }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}
