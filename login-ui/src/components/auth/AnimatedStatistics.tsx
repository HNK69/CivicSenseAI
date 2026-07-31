import { useEffect, useRef } from "react";
import { animate, motion, useInView, useReducedMotion } from "motion/react";
import { CheckCircle2, Cpu, Radio, Users } from "lucide-react";
import { fadeUp, stagger } from "@/lib/motion";

type Stat = {
  label: string;
  value: number;
  suffix?: string;
  caption: string;
  Icon: typeof Users;
};

const STATS: Stat[] = [
  { label: "Issues Resolved", value: 128400, suffix: "+", caption: "Across 42 municipal wards", Icon: CheckCircle2 },
  { label: "AI Powered Analysis", value: 99.2, suffix: "%", caption: "Report triage accuracy", Icon: Cpu },
  { label: "Citizens Connected", value: 2.4, suffix: "M", caption: "Verified civic accounts", Icon: Users },
  { label: "Live Monitoring", value: 24, suffix: "/7", caption: "Officer response coverage", Icon: Radio },
];

function Counter({ to, suffix }: { to: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const decimals = to % 1 !== 0 ? 1 : 0;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const format = (v: number) =>
      `${v.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix ?? ""}`;
    if (!inView) return;
    if (reduce) {
      node.textContent = format(to);
      return;
    }
    const controls = animate(0, to, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = format(v);
      },
    });
    return () => controls.stop();
  }, [inView, to, suffix, decimals, reduce]);

  return <span ref={ref}>0{suffix}</span>;
}

export function AnimatedStatistics() {
  return (
    <motion.dl
      variants={stagger(0.12, 0.5)}
      initial="hidden"
      animate="visible"
      className="grid w-full max-w-2xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/60 sm:grid-cols-2"
    >
      {STATS.map(({ label, value, suffix, caption, Icon }) => (
        <motion.div
          key={label}
          variants={fadeUp}
          whileHover={{ y: -3 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="group relative bg-card/70 p-5 backdrop-blur-sm"
        >
          <div className="flex items-center gap-2.5">
            <motion.span
              whileHover={{ rotate: -8, scale: 1.1 }}
              className="flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-accent"
            >
              <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
            </motion.span>
            <dt className="text-[0.7rem] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              {label}
            </dt>
          </div>
          <dd className="mt-3 font-display text-3xl font-semibold tracking-tight tabular-nums text-foreground">
            <Counter to={value} suffix={suffix} />
          </dd>
          <p className="mt-1 text-sm text-muted-foreground">{caption}</p>
          <span className="pointer-events-none absolute inset-x-5 bottom-0 h-px origin-left scale-x-0 bg-accent/60 transition-transform duration-500 group-hover:scale-x-100" />
        </motion.div>
      ))}
    </motion.dl>
  );
}
