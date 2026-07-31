import { motion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { fadeUp, stagger, wordReveal } from '../../lib/motion.js';
import { AnimatedStatistics } from './AnimatedStatistics.jsx';
import { useParallax } from './MouseParallax.jsx';

const TITLE = ['Civic', 'Sense', 'AI'];

export function HeroSection() {
  const { x, y } = useParallax(-18);

  return (
    <motion.section
      style={{
        x, y,
        position: 'relative', zIndex: 10,
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: '2.5rem', padding: '4rem 1.5rem',
        width: '100%',
      }}
    >
      <motion.div variants={stagger(0.1)} initial="hidden" animate="visible" style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
        <motion.div
          variants={fadeUp}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
            borderRadius: '9999px', border: '1px solid rgba(36,59,83,0.15)',
            background: 'rgba(255,255,255,0.6)', padding: '0.375rem 0.75rem',
            fontSize: '0.7rem', fontWeight: 500, letterSpacing: '0.05em',
            color: 'var(--text-secondary)', backdropFilter: 'blur(8px)',
            width: 'fit-content',
          }}
        >
          <ShieldCheck size={14} strokeWidth={2} color="var(--auth-accent)" aria-hidden="true" />
          Government-grade civic infrastructure
        </motion.div>

        <h1 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(3rem, 8.5vw, 6rem)',
          fontWeight: 700, lineHeight: 0.92, letterSpacing: '-0.045em',
          color: 'var(--text-primary)', margin: 0,
        }}>
          <motion.span variants={stagger(0.09, 0.15)} style={{ display: 'flex', flexWrap: 'wrap' }}>
            {TITLE.map((word, i) => (
              <span key={word} style={{ overflow: 'hidden', paddingBottom: '0.25rem', paddingRight: '0.35rem' }}>
                <motion.span
                  variants={wordReveal}
                  style={{
                    display: 'inline-block',
                    ...(i === 2 ? { fontStyle: 'italic', fontWeight: 400, color: 'var(--auth-accent)' } : {}),
                  }}
                >
                  {word}
                </motion.span>
              </span>
            ))}
          </motion.span>
        </h1>

        <motion.p
          variants={fadeUp}
          style={{
            maxWidth: '32rem', fontSize: '1.1rem', lineHeight: 1.7,
            color: 'var(--text-secondary)', margin: 0,
          }}
        >
          Smarter civic intelligence.{' '}
          <span style={{ color: 'var(--text-primary)' }}>
            Connecting citizens and officers through AI.
          </span>
        </motion.p>
      </motion.div>

      <AnimatedStatistics />

      <motion.p
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 1.1 }}
        style={{ maxWidth: '28rem', fontSize: '0.75rem', lineHeight: 1.7, color: 'rgba(102,102,102,0.8)', margin: 0 }}
      >
        Operated under municipal data-protection standards. All reports are encrypted end to end and routed to accountable officers.
      </motion.p>
    </motion.section>
  );
}
