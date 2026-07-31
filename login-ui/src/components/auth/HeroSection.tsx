import { motion } from "motion/react";
import { ShieldCheck } from "lucide-react";
import { fadeUp, stagger, wordReveal } from "@/lib/motion";
import { AnimatedStatistics } from "./AnimatedStatistics";
import { useParallax } from "./MouseParallax";

const TITLE = ["Civic", "Sense", "AI"];

export function HeroSection() {
  const { x, y } = useParallax(-18);

  return (
    <motion.section
      style={{ x, y }}
      className="relative z-10 flex w-full flex-col justify-center gap-10 px-6 py-16 sm:px-10 lg:h-full lg:px-16 xl:px-24"
    >
      <motion.div variants={stagger(0.1)} initial="hidden" animate="visible" className="space-y-7">
        <motion.div
          variants={fadeUp}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/60 px-3 py-1.5 text-xs font-medium tracking-wide text-muted-foreground backdrop-blur-sm"
        >
          <ShieldCheck className="size-3.5 text-accent" strokeWidth={2} aria-hidden="true" />
          Government-grade civic infrastructure
        </motion.div>

        <h1 className="font-display text-[clamp(3.2rem,8.5vw,7.5rem)] font-semibold leading-[0.92] tracking-[-0.045em] text-foreground">
          <motion.span variants={stagger(0.09, 0.15)} className="flex flex-wrap">
            {TITLE.map((word, i) => (
              <span key={word} className="overflow-hidden pb-1">
                <motion.span
                  variants={wordReveal}
                  className={i === 2 ? "inline-block font-serif italic font-normal text-accent" : "inline-block"}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </motion.span>
        </h1>

        <motion.p
          variants={fadeUp}
          className="max-w-lg text-balance text-lg leading-relaxed text-muted-foreground sm:text-xl"
        >
          Smarter civic intelligence.{" "}
          <span className="text-foreground">
            Connecting citizens and officers through AI.
          </span>
        </motion.p>
      </motion.div>

      <AnimatedStatistics />

      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 1.1 }}
        className="max-w-md text-xs leading-relaxed text-muted-foreground/80"
      >
        Operated under municipal data-protection standards. All reports are
        encrypted end to end and routed to accountable officers.
      </motion.p>
    </motion.section>
  );
}
