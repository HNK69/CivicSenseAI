import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { fieldEnter } from "@/lib/motion";

export type SubmitState = "idle" | "loading" | "success";

export function SubmitButton({ state, label }: { state: SubmitState; label: string }) {
  return (
    <motion.button
      variants={fieldEnter}
      type="submit"
      disabled={state !== "idle"}
      whileHover={state === "idle" ? { y: -2 } : undefined}
      whileTap={state === "idle" ? { scale: 0.975, y: 0 } : undefined}
      transition={{ type: "spring", stiffness: 380, damping: 26 }}
      className="submit-button group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-sm font-medium tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel disabled:cursor-not-allowed"
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === "idle" && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex items-center gap-2"
          >
            {label}
            <ArrowRight
              className="size-4 transition-transform duration-300 group-hover:translate-x-1"
              strokeWidth={2}
              aria-hidden="true"
            />
          </motion.span>
        )}
        {state === "loading" && (
          <motion.span key="loading" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            <span className="sr-only">Submitting</span>
          </motion.span>
        )}
        {state === "success" && (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: "spring", stiffness: 420, damping: 18 }}
            className="flex items-center gap-2"
          >
            <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
            Verified
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
