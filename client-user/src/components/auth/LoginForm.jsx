import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { KeyRound, Mail } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Field } from './Field.jsx';
import { SubmitButton } from './SubmitButton.jsx';
import { shake, stagger } from '../../lib/motion.js';
import { useAuthContext } from '../../context/AuthContext.jsx';
import { loginOfficer } from '../../services/officerAuthService.js';
import { loginContractor } from '../../services/contractorAuthService.js';

export function LoginForm({ role }) {
  const [values, setValues] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState('idle');
  const [shaking, setShaking] = useState(false);
  const [serverError, setServerError] = useState('');

  const { login } = useAuthContext();
  const navigate = useNavigate();

  const validate = () => {
    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) next.email = 'Enter a valid email address.';
    if (values.password.length < 6) next.password = 'Password must be at least 6 characters.';
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
      result = await loginOfficer({ email: values.email, password: values.password });
    } else if (role === 'contractor') {
      result = await loginContractor({ email: values.email, password: values.password });
    } else {
      result = await login(values.email, values.password);
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
        } else if (role === 'contractor') {
          const contractor = result.contractor || {};
          const token   = result.accessToken || '';
          const refresh = result.refreshToken || '';
          const contractorUserStr = encodeURIComponent(JSON.stringify(contractor));
          window.location.href = `http://localhost:5173/login?role=contractor&token=${token}&refresh=${refresh}&user=${contractorUserStr}`;
        } else {
          navigate('/dashboard');
        }
      }, 800);
    } else {
      setState('idle');
      setServerError(result.message || 'Login failed. Please check your credentials.');
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
    }
  };

  return (
    <motion.form
      layout
      onSubmit={submit}
      noValidate
      variants={{ ...stagger(0.07, 0.05), ...shake }}
      initial="hidden"
      animate={shaking ? 'shake' : 'visible'}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
    >
      <Field
        label={role === 'contractor' ? 'Contractor email' : role === 'officer' ? 'Officer email' : 'Email address'}
        Icon={Mail}
        type="email"
        autoComplete="email"
        placeholder={role === 'contractor' ? 'contractor@apex.gov.in' : role === 'officer' ? 'officer@civicsense.gov.in' : 'name@city.gov'}
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

      <motion.div
        variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingTop: '0.25rem' }}
      >
        <button
          type="button"
          style={{ fontSize: '0.85rem', color: 'rgba(36,59,83,0.7)', background: 'none', border: 'none', cursor: 'pointer' }}
        >
          Forgot password?
        </button>
      </motion.div>

      <SubmitButton state={state} label={role === 'contractor' ? 'Sign In to Contractor Portal' : role === 'officer' ? 'Sign In to Officer Portal' : 'Continue'} />
    </motion.form>
  );
}
