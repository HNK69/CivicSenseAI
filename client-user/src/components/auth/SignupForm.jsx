import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Mail, Phone, ShieldCheck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Field } from './Field.jsx';
import { SubmitButton } from './SubmitButton.jsx';
import { shake, stagger } from '../../lib/motion.js';
import { roleConfig } from './roles.js';
import { useAuthContext } from '../../context/AuthContext.jsx';

export function SignupForm({ role }) {
  const [values, setValues] = useState({ fullName: '', email: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle');
  const [shaking, setShaking] = useState(false);
  const [serverError, setServerError] = useState('');

  const { register } = useAuthContext();
  const navigate = useNavigate();

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const validate = () => {
    const next = {};
    if (values.fullName.trim().length < 2) next.fullName = 'Enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email address.';
    if (values.phone.replace(/\D/g, '').length < 8) next.phone = 'Enter a reachable phone number.';
    if (values.password.length < 6) next.password = 'Use at least 6 characters.';
    if (values.confirm !== values.password) next.confirm = 'Passwords do not match.';
    return next;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length) {
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
      return;
    }

    setState('loading');
    let result;
    if (role === 'officer') {
      const { registerOfficer } = await import('../../services/officerAuthService.js');
      result = await registerOfficer({
        name: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
    } else {
      result = await register({
        name: values.fullName,
        email: values.email,
        phone: values.phone,
        password: values.password,
      });
    }

    if (result.success) {
      setState('success');
      setTimeout(() => {
        if (role === 'officer') {
          const officer = result.officer || {};
          const token   = result.accessToken || '';
          const refresh = result.refreshToken || '';
          const officerUserStr = encodeURIComponent(JSON.stringify(officer));
          window.location.href = `http://localhost:5173/login?token=${token}&refresh=${refresh}&user=${officerUserStr}`;
        } else {
          navigate('/dashboard');
        }
      }, 800);
    } else {
      setState('idle');
      setServerError(result.message || 'Registration failed. Please try again.');
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
    }
  };

  const config = roleConfig(role);

  return (
    <motion.form
      layout
      onSubmit={submit}
      noValidate
      variants={{ ...stagger(0.06, 0.05), ...shake }}
      initial="hidden"
      animate={shaking ? 'shake' : 'visible'}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <motion.div
        variants={{ hidden: { opacity: 0, y: 10 }, visible: { opacity: 1, y: 0 } }}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.5rem',
          borderRadius: '0.75rem', border: '1px solid rgba(36,59,83,0.1)',
          background: 'rgba(255,255,255,0.5)', padding: '0.625rem 0.75rem',
          fontSize: '0.75rem', color: 'var(--text-secondary)',
        }}
      >
        <ShieldCheck size={14} color="var(--auth-accent)" strokeWidth={2} aria-hidden="true" />
        Registering as{' '}
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{config?.title}</span>
      </motion.div>

      <Field label="Full name" Icon={UserRound} autoComplete="name" placeholder="Aarav Mehta" value={values.fullName} error={errors.fullName} onChange={set('fullName')} />
      <Field label="Email address" Icon={Mail} type="email" autoComplete="email" placeholder="name@city.gov" value={values.email} error={errors.email} onChange={set('email')} />
      <Field label="Phone" Icon={Phone} type="tel" autoComplete="tel" placeholder="+91 98765 43210" value={values.phone} error={errors.phone} onChange={set('phone')} />
      <Field label="Password" Icon={KeyRound} reveal autoComplete="new-password" placeholder="••••••••" value={values.password} error={errors.password} onChange={set('password')} />
      <Field label="Confirm password" Icon={KeyRound} reveal autoComplete="new-password" placeholder="••••••••" value={values.confirm} error={errors.confirm} onChange={set('confirm')} />

      <AnimatePresence>
        {serverError && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ fontSize: '0.8rem', color: '#B94A48', margin: 0, padding: '0.5rem 0.75rem', background: '#FDF1F1', borderRadius: '0.5rem' }}
          >
            {serverError}
          </motion.p>
        )}
      </AnimatePresence>

      <SubmitButton state={state} label="Create account" />
    </motion.form>
  );
}
