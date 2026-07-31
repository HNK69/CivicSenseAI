import { useRef, useState } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { ArrowLeft } from "lucide-react";
import { RoleSelector } from "./RoleSelector";
import { LoginForm } from "./LoginForm";
import { SignupForm } from "./SignupForm";
import { roleConfig, type Role } from "./roles";
import { ease } from "@/lib/motion";

type Mode = "login" | "signup";

export function AuthPanel() {
  const [role, setRole] = useState<Role | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const reduce = useReducedMotion();

  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [3.5, -3.5]), { stiffness: 120, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-3.5, 3.5]), { stiffness: 120, damping: 20 });

  const onMove = (e: React.PointerEvent) => {
    if (reduce || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  const heading = role ? roleConfig(role).portal : "Secure access";
  const sub = role
    ? mode === "login"
      ? "Sign in to continue to your workspace."
      : "Create your account to get started."
    : "Select how you'll be using CivicSenseAI.";

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => {
        mx.set(0);
        my.set(0);
      }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1400 }}
      initial={{ opacity: 0, y: 32, filter: "blur(8px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.9, ease, delay: 0.25 }}
      data-accent={role ?? "neutral"}
      className="auth-panel relative w-full max-w-[27rem]"
    >
      <motion.div layout transition={{ duration: 0.5, ease }} className="relative p-7 sm:p-8">
        <LayoutGroup>
          <motion.header layout className="mb-6">
            <div className="flex items-center justify-between">
              <motion.span
                layout
                className="text-[0.68rem] font-medium uppercase tracking-[0.22em] text-muted-foreground"
              >
                CivicSenseAI
              </motion.span>
              {role && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => {
                    setRole(null);
                    setMode("login");
                  }}
                  className="flex items-center gap-1 rounded-md text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                  Change role
                </motion.button>
              )}
            </div>

            <div className="mt-4 overflow-hidden">
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2
                  key={heading}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease }}
                  className="font-display text-2xl font-semibold tracking-tight text-foreground"
                >
                  {heading}
                </motion.h2>
              </AnimatePresence>
            </div>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={sub}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="mt-1.5 text-sm text-muted-foreground"
              >
                {sub}
              </motion.p>
            </AnimatePresence>
          </motion.header>

          <AnimatePresence mode="wait" initial={false}>
            {!role ? (
              <motion.div
                key="roles"
                layout
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -14, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease }}
              >
                <RoleSelector value={role} onChange={setRole} />
              </motion.div>
            ) : (
              <motion.div
                key={mode}
                layout
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18, filter: "blur(4px)" }}
                transition={{ duration: 0.4, ease }}
              >
                {mode === "login" ? <LoginForm /> : <SignupForm role={role} />}
              </motion.div>
            )}
          </AnimatePresence>

          {role && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-6 flex items-center justify-center gap-2 border-t border-border/60 pt-5 text-sm"
            >
              <span className="text-muted-foreground">
                {mode === "login" ? "Don't have an account?" : "Already registered?"}
              </span>
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setMode((m) => (m === "login" ? "signup" : "login"))}
                className="link-underline font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {mode === "login" ? "Create account" : "Sign in"}
              </motion.button>
            </motion.div>
          )}
        </LayoutGroup>
      </motion.div>
    </motion.div>
  );
}
