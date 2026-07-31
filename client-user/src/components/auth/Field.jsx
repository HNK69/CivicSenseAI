import { useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Eye, EyeOff } from 'lucide-react';
import { fieldEnter } from '../../lib/motion.js';

export function Field({ label, Icon, error, reveal, type = 'text', ...props }) {
  const id = useId();
  const [shown, setShown] = useState(false);
  const inputType = reveal ? (shown ? 'text' : 'password') : type;

  return (
    <motion.div variants={fieldEnter} style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      <label
        htmlFor={id}
        style={{ display: 'block', fontSize: '0.72rem', fontWeight: 500, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}
      >
        {label}
      </label>
      <motion.div
        whileFocus={{ y: -2 }}
        className="auth-field-shell"
        data-invalid={Boolean(error)}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', borderRadius: '0.75rem', border: '1px solid rgba(36,59,83,0.1)', background: 'rgba(255,255,255,0.6)' }}
      >
        <Icon
          style={{ position: 'absolute', left: '0.875rem', color: 'var(--text-muted)', flexShrink: 0 }}
          size={16} strokeWidth={1.75} aria-hidden="true"
        />
        <input
          id={id}
          type={inputType}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : undefined}
          style={{
            width: '100%', background: 'transparent', padding: '0.75rem 2.5rem 0.75rem 2.5rem',
            fontSize: '0.875rem', color: 'var(--text-primary)', outline: 'none', border: 'none',
          }}
          {...props}
        />
        {reveal && (
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute', right: '0.75rem', padding: '0.25rem',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            }}
          >
            {shown ? <EyeOff size={16} strokeWidth={1.75} /> : <Eye size={16} strokeWidth={1.75} />}
          </button>
        )}
      </motion.div>
      <AnimatePresence>
        {error && (
          <motion.p
            id={`${id}-error`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ fontSize: '0.75rem', color: '#B94A48', margin: 0 }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
