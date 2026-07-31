import { motion } from 'framer-motion';

const PARTICLES = [
  { x: 12, y: 22, s: 3, d: 14 },
  { x: 28, y: 68, s: 2, d: 18 },
  { x: 41, y: 12, s: 4, d: 22 },
  { x: 55, y: 44, s: 2, d: 16 },
  { x: 68, y: 78, s: 3, d: 20 },
  { x: 77, y: 30, s: 2, d: 24 },
  { x: 8,  y: 82, s: 2, d: 19 },
  { x: 34, y: 90, s: 3, d: 26 },
  { x: 90, y: 58, s: 2, d: 21 },
  { x: 63, y: 8,  s: 2, d: 17 },
];

/** Dust-fine drifting points plus thin connective strokes. */
export function FloatingParticles() {
  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        {[
          ['12%', '22%', '41%', '12%'],
          ['41%', '12%', '55%', '44%'],
          ['55%', '44%', '28%', '68%'],
          ['28%', '68%', '34%', '90%'],
          ['55%', '44%', '77%', '30%'],
        ].map(([x1, y1, x2, y2], i) => (
          <motion.line
            key={i}
            x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="var(--auth-line-faint)"
            strokeWidth="1"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: [0.15, 0.5, 0.15] }}
            transition={{
              pathLength: { duration: 2.4, delay: 0.4 + i * 0.2 },
              opacity: { duration: 9 + i, repeat: Infinity, ease: 'easeInOut' },
            }}
          />
        ))}
      </svg>
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.s,
            height: p.s,
            background: 'rgba(36,59,83,0.25)',
          }}
          animate={{ y: [0, -22, 0], opacity: [0.2, 0.7, 0.2] }}
          transition={{ duration: p.d, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}
