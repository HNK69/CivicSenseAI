import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { KeyRound, Mail } from "lucide-react";
import { Field } from "./Field";
import { SubmitButton, type SubmitState } from "./SubmitButton";
import { shake, stagger } from "@/lib/motion";

type Errors = { email?: string; password?: string };

export function LoginForm() {
  const [values, setValues] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [shaking, setShaking] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = "Enter a valid email address.";
    if (values.password.length < 8) next.password = "Password must be at least 8 characters.";
    setErrors(next);
    if (Object.keys(next).length) {
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
      return;
    }
    setState("loading");
    setTimeout(() => setState("success"), 1300);
  };

  return (
    <motion.form
      layout
      onSubmit={submit}
      noValidate
      variants={{ ...stagger(0.07, 0.05), ...shake }}
      initial="hidden"
      animate={shaking ? "shake" : "visible"}
      className="space-y-4"
    >
      <Field
        label="Email address"
        Icon={Mail}
        type="email"
        autoComplete="email"
        placeholder="name@city.gov"
        value={values.email}
        error={errors.email}
        onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))}
      />
      <Field
        label="Password"
        Icon={KeyRound}
        reveal
        autoComplete="current-password"
        placeholder="••••••••"
        value={values.password}
        error={errors.password}
        onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))}
      />

      <motion.div variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }} className="flex items-center justify-between pt-1">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            className="size-4 rounded border-border accent-[var(--accent)] outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          Remember me
        </label>
        <button
          type="button"
          className="link-underline text-sm text-foreground/80 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Forgot password?
        </button>
      </motion.div>

      <SubmitButton state={state} label="Continue" />
    </motion.form>
  );
}
