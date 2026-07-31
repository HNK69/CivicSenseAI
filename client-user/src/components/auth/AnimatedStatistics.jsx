import { useEffect, useRef } from 'react';
import { animate, motion, useInView } from 'framer-motion';
import { CheckCircle2, Cpu, Radio, Users } from 'lucide-react';
import { fadeUp, stagger } from '../../lib/motion.js';

const STATS = [
  { label: 'Issues Resolved',    value: 128400, suffix: '+', caption: 'Across 42 municipal wards', Icon: CheckCircle2 },
  { label: 'AI Powered Analysis', value: 99.2,  suffix: '%', caption: 'Report triage accuracy',   Icon: Cpu },
  { label: 'Citizens Connected', value: 2.4,   suffix: 'M', caption: 'Verified civic accounts',  Icon: Users },
  { label: 'Live Monitoring',    value: 24,     suffix: '/7', caption: 'Officer response coverage', Icon: Radio },
];

function Counter({ to, suffix }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-40px' });
  const decimals = to % 1 !== 0 ? 1 : 0;

  useEffect(() => {
    const node = ref.current;
    if (!node || !inView) return;
    const format = (v) =>
      `${v.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}${suffix ?? ''}`;
    const controls = animate(0, to, {
      duration: 1.8,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { node.textContent = format(v); },
    });
    return () => controls.stop();
  }, [inView, to, suffix, decimals]);

  return <span ref={ref}>0{suffix}</span>;
}

export function AnimatedStatistics() {
  return (
    <motion.dl
      variants={stagger(0.12, 0.5)}
      initial="hidden"
      animate="visible"
      style={{
        display: 'grid',
        width: '100%',
        maxWidth: '42rem',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '1px',
        overflow: 'hidden',
        borderRadius: '1rem',
        border: '1px solid rgba(36,59,83,0.12)',
        background: 'rgba(36,59,83,0.08)',
      }}
    >
      {STATS.map(({ label, value, suffix, caption, Icon }) => (
        <motion.div
          key={label}
          variants={fadeUp}
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          style={{
            position: 'relative',
            background: 'rgba(255,255,255,0.7)',
            padding: '1.25rem',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
            <motion.span
              whileHover={{ rotate: -8, scale: 1.1 }}
              style={{
                display: 'flex', width: '2rem', height: '2rem',
                alignItems: 'center', justifyContent: 'center',
                borderRadius: '0.5rem',
                border: '1px solid rgba(36,59,83,0.12)',
                background: 'rgba(255,255,255,0.6)',
                color: 'var(--auth-accent)',
              }}
            >
              <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
            </motion.span>
            <dt style={{ fontSize: '0.68rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-secondary)' }}>
              {label}
            </dt>
          </div>
          <dd style={{ marginTop: '0.75rem', fontFamily: "'Space Grotesk', sans-serif", fontSize: '1.75rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            <Counter to={value} suffix={suffix} />
          </dd>
          <p style={{ marginTop: '0.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{caption}</p>
          <span style={{
            position: 'absolute', left: '1.25rem', right: '1.25rem', bottom: 0,
            height: '1px', background: 'var(--auth-accent)',
            transformOrigin: 'left',
            transform: 'scaleX(0)',
            transition: 'transform 0.5s ease',
          }} className="auth-stat-line" />
        </motion.div>
      ))}
    </motion.dl>
  );
}
