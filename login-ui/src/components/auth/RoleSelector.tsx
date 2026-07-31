import { motion } from "motion/react";
import { Check } from "lucide-react";
import { fadeUp, stagger } from "@/lib/motion";
import { ROLES, type Role } from "./roles";

export function RoleSelector({
  value,
  onChange,
}: {
  value: Role | null;
  onChange: (role: Role) => void;
}) {
  return (
    <motion.div
      variants={stagger(0.09, 0.15)}
      initial="hidden"
      animate="visible"
      role="radiogroup"
      aria-label="Choose how you want to sign in"
      className="grid gap-3"
    >
      {ROLES.map(({ id, title, description, Icon }) => {
        const selected = value === id;
        return (
          <motion.button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            variants={fadeUp}
            onClick={() => onChange(id)}
            whileHover={{ y: -3, scale: 1.012 }}
            whileTap={{ scale: 0.985 }}
            transition={{ type: "spring", stiffness: 320, damping: 26 }}
            data-role={id}
            className="role-card group relative flex w-full items-start gap-4 rounded-2xl border p-4 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
            data-selected={selected}
          >
            {selected && (
              <motion.span
                layoutId="role-halo"
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className="pointer-events-none absolute inset-0 rounded-2xl"
                style={{ boxShadow: "var(--glow-accent)", background: "var(--role-selected-bg)" }}
              />
            )}
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-background/70 text-foreground/80 transition-colors group-hover:text-accent">
              <Icon className="size-[18px]" strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="relative flex-1">
              <span className="block text-[0.95rem] font-semibold tracking-tight text-foreground">
                {title}
              </span>
              <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">
                {description}
              </span>
            </span>
            <motion.span
              initial={false}
              animate={{
                scale: selected ? 1 : 0.7,
                opacity: selected ? 1 : 0.35,
              }}
              transition={{ type: "spring", stiffness: 400, damping: 24 }}
              className="relative mt-0.5 flex size-5 items-center justify-center rounded-full border border-border data-[on=true]:border-transparent data-[on=true]:bg-accent"
              data-on={selected}
            >
              {selected && <Check className="size-3 text-accent-foreground" strokeWidth={3} aria-hidden="true" />}
            </motion.span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
