import { useRef, useState } from 'react';
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { RoleSelector } from './RoleSelector.jsx';
import { LoginForm } from './LoginForm.jsx';
import { SignupForm } from './SignupForm.jsx';
import { roleConfig } from './roles.js';
import { ease } from '../../lib/motion.js';

export function AuthPanel({ defaultRole = 'citizen' }) {
  const [role, setRole] = useState(defaultRole);
  const [mode, setMode] = useState('login');

  const ref = useRef(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [3.5, -3.5]), { stiffness: 120, damping: 20 });
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-3.5, 3.5]), { stiffness: 120, damping: 20 });

  const onMove = (e) => {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };

  const heading = role ? roleConfig(role)?.portal : 'Secure access';
  const sub = role
    ? mode === 'login'
      ? 'Sign in to continue to your workspace.'
      : 'Create your account to get started.'
    : "Select how you'll be using CivicSenseAI.";

  return (
    <motion.div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={() => { mx.set(0); my.set(0); }}
      style={{ rotateX: rx, rotateY: ry, transformPerspective: 1400, position: 'relative', width: '100%', maxWidth: '27rem' }}
      initial={{ opacity: 0, y: 32, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.9, ease, delay: 0.25 }}
      data-accent={role ?? 'neutral'}
      className="auth-panel"
    >
      <motion.div layout transition={{ duration: 0.5, ease }} style={{ position: 'relative', padding: '2rem' }}>
        <LayoutGroup>
          <motion.header layout style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <motion.span
                layout
                style={{ fontSize: '0.68rem', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.22em', color: 'var(--text-secondary)' }}
              >
                CivicSenseAI
              </motion.span>
              {role && (
                <motion.button
                  type="button"
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  onClick={() => { setRole(null); setMode('login'); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    borderRadius: '0.375rem', fontSize: '0.75rem', color: 'var(--text-secondary)',
                    background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.2s ease',
                  }}
                >
                  <ArrowLeft size={14} strokeWidth={1.75} aria-hidden="true" />
                  Change role
                </motion.button>
              )}
            </div>

            <div style={{ marginTop: '1rem', overflow: 'hidden' }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.h2
                  key={heading}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease }}
                  style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.5rem', fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text-primary)', margin: 0 }}
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
                style={{ marginTop: '0.375rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}
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
                exit={{ opacity: 0, y: -14, filter: 'blur(4px)' }}
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
                exit={{ opacity: 0, y: -18, filter: 'blur(4px)' }}
                transition={{ duration: 0.4, ease }}
              >
                {mode === 'login'
                  ? <LoginForm role={role} />
                  : <SignupForm role={role} />
                }
              </motion.div>
            )}
          </AnimatePresence>

          {role && (
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.25 }}
              style={{
                marginTop: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: '0.5rem', borderTop: '1px solid rgba(36,59,83,0.1)', paddingTop: '1.25rem',
                fontSize: '0.875rem',
              }}
            >
              <span style={{ color: 'var(--text-secondary)' }}>
                {mode === 'login' ? "Don't have an account?" : 'Already registered?'}
              </span>
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setMode((m) => (m === 'login' ? 'signup' : 'login'))}
                style={{
                  fontWeight: 500, color: 'var(--text-primary)', background: 'none',
                  border: 'none', cursor: 'pointer', fontSize: '0.875rem', padding: 0,
                  position: 'relative',
                }}
                className="auth-link-underline"
              >
                {mode === 'login' ? 'Create account' : 'Sign in'}
              </motion.button>
            </motion.div>
          )}
        </LayoutGroup>
      </motion.div>
    </motion.div>
  );
}
