import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { fadeUp, stagger } from '../../lib/motion.js';
import { ROLES } from './roles.js';

export function RoleSelector({ value, onChange }) {
  return (
    <motion.div
      variants={stagger(0.09, 0.15)}
      initial="hidden"
      animate="visible"
      role="radiogroup"
      aria-label="Choose how you want to sign in"
      style={{ display: 'grid', gap: '0.75rem' }}
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
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            data-role={id}
            data-selected={selected}
            className="auth-role-card"
            style={{
              position: 'relative', display: 'flex', alignItems: 'flex-start', gap: '1rem',
              width: '100%', padding: '1rem', textAlign: 'left', borderRadius: '1rem',
              border: `1px solid ${selected ? 'color-mix(in srgb, var(--auth-accent) 45%, transparent)' : 'rgba(36,59,83,0.09)'}`,
              background: selected ? 'linear-gradient(140deg, color-mix(in srgb, var(--auth-accent) 7%, transparent), transparent 70%)' : 'rgba(255,255,255,0.55)',
              cursor: 'pointer', outline: 'none',
              transition: 'border-color 0.35s ease, background 0.35s ease, box-shadow 0.35s ease',
            }}
          >
            <span style={{
              display: 'flex', width: '2.5rem', height: '2.5rem', flexShrink: 0,
              alignItems: 'center', justifyContent: 'center',
              borderRadius: '0.75rem', border: '1px solid rgba(36,59,83,0.12)',
              background: 'rgba(255,255,255,0.7)', color: 'rgba(36,59,83,0.7)',
            }}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: '0.925rem', fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-primary)' }}>
                {title}
              </span>
              <span style={{ display: 'block', marginTop: '0.1rem', fontSize: '0.85rem', lineHeight: 1.4, color: 'var(--text-secondary)' }}>
                {description}
              </span>
            </span>
            <motion.span
              initial={false}
              animate={{ scale: selected ? 1 : 0.7, opacity: selected ? 1 : 0.35 }}
              transition={{ type: 'spring', stiffness: 400, damping: 24 }}
              style={{
                marginTop: '0.1rem', display: 'flex', width: '1.25rem', height: '1.25rem',
                alignItems: 'center', justifyContent: 'center', borderRadius: '9999px',
                border: selected ? 'none' : '1px solid rgba(36,59,83,0.2)',
                background: selected ? 'var(--auth-accent)' : 'transparent',
                flexShrink: 0,
              }}
            >
              {selected && <Check size={12} strokeWidth={3} color="#fff" aria-hidden="true" />}
            </motion.span>
          </motion.button>
        );
      })}
    </motion.div>
  );
}
