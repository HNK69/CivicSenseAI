import { useId, useState, type InputHTMLAttributes } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeOff, type LucideIcon } from "lucide-react";
import { fieldEnter } from "@/lib/motion";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  Icon: LucideIcon;
  error?: string;
  reveal?: boolean;
};

export function Field({ label, Icon, error, reveal, type = "text", ...props }: FieldProps) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const inputType = reveal ? (shown ? "text" : "password") : type;

  return (
    <motion.div variants={fieldEnter} className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium tracking-wide text-muted-foreground">
        {label}
      </label>
      <motion.div
        whileFocus={{ y: -2 }}
        className="field-shell relative flex items-center rounded-xl border bg-background/60 transition-shadow focus-within:-translate-y-0.5"
        data-invalid={Boolean(error)}
      >
        <Icon
          className="pointer-events-none absolute left-3.5 size-4 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <input
          id={id}
          type={inputType}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          className="w-full bg-transparent py-3 pl-10 pr-10 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
          {...props}
        />
        {reveal && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute right-3 rounded-md p-1 text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          >
            {shown ? <EyeOff className="size-4" strokeWidth={1.75} /> : <Eye className="size-4" strokeWidth={1.75} />}
          </button>
        )}
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-xs text-destructive"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
