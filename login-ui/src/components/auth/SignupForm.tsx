import { useState, type FormEvent } from "react";
import { motion } from "motion/react";
import { KeyRound, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
import { Field } from "./Field";
import { SubmitButton, type SubmitState } from "./SubmitButton";
import { shake, stagger } from "@/lib/motion";
import { roleConfig, type Role } from "./roles";

type Errors = Partial<Record<"fullName" | "email" | "phone" | "password" | "confirm", string>>;

export function SignupForm({ role }: { role: Role }) {
  const [values, setValues] = useState({ fullName: "", email: "", phone: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Errors>({});
  const [state, setState] = useState<SubmitState>("idle");
  const [shaking, setShaking] = useState(false);

  const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: Errors = {};
    if (values.fullName.trim().length < 2) next.fullName = "Enter your full name.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = "Enter a valid email address.";
    if (values.phone.replace(/\D/g, "").length < 8) next.phone = "Enter a reachable phone number.";
    if (values.password.length < 8) next.password = "Use at least 8 characters.";
    if (values.confirm !== values.password) next.confirm = "Passwords do not match.";
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
      variants={{ ...stagger(0.06, 0.05), ...shake }}
      initial="hidden"
      animate={shaking ? "shake" : "visible"}
      className="space-y-4"
    >
      <motion.div
        variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
        className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2.5 text-xs text-muted-foreground"
      >
        <ShieldCheck className="size-3.5 text-accent" strokeWidth={2} aria-hidden="true" />
        Registering as{" "}
        <span className="font-medium text-foreground">{roleConfig(role).title}</span>
      </motion.div>

      <Field label="Full name" Icon={UserRound} autoComplete="name" placeholder="Aarav Mehta" value={values.fullName} error={errors.fullName} onChange={set("fullName")} />
      <Field label="Email address" Icon={Mail} type="email" autoComplete="email" placeholder="name@city.gov" value={values.email} error={errors.email} onChange={set("email")} />
      <Field label="Phone" Icon={Phone} type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={values.phone} error={errors.phone} onChange={set("phone")} />
      <Field label="Password" Icon={KeyRound} reveal autoComplete="new-password" placeholder="••••••••" value={values.password} error={errors.password} onChange={set("password")} />
      <Field label="Confirm password" Icon={KeyRound} reveal autoComplete="new-password" placeholder="••••••••" value={values.confirm} error={errors.confirm} onChange={set("confirm")} />

      <SubmitButton state={state} label="Create account" />
    </motion.form>
  );
}
