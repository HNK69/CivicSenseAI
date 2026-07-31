import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, Check, Loader2 } from 'lucide-react';
import { fieldEnter } from '../../lib/motion.js';

export function SubmitButton({ state, label }) {
  return (
    <motion.button
      variants={fieldEnter}
      type="submit"
      disabled={state !== 'idle'}
      whileHover={state === 'idle' ? { y: -2 } : undefined}
      whileTap={state === 'idle' ? { scale: 0.975, y: 0 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      className="auth-submit-button"
      style={{
        width: '100%', height: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: '0.5rem', overflow: 'hidden', borderRadius: '0.75rem', fontSize: '0.875rem',
        fontWeight: 500, letterSpacing: '-0.01em', border: 'none', cursor: state !== 'idle' ? 'not-allowed' : 'pointer',
        color: '#fff',
        background: 'linear-gradient(160deg, color-mix(in srgb, var(--auth-accent) 92%, white 8%), color-mix(in srgb, var(--auth-accent) 78%, black 22%))',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 10px 24px -14px var(--auth-accent)',
        transition: 'background 0.4s ease, box-shadow 0.3s ease',
        outline: 'none',
      }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {state === 'idle' && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            {label}
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </motion.span>
        )}
        {state === 'loading' && (
          <motion.span key="loading" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }}>
            <Loader2 size={16} strokeWidth={2} className="spin" aria-hidden="true" />
            <span className="sr-only">Submitting</span>
          </motion.span>
        )}
        {state === 'success' && (
          <motion.span
            key="success"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 18 }}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            Verified
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
