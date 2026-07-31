import { motion } from 'framer-motion';
import { AnimatedGrid } from './AnimatedGrid.jsx';
import { FloatingParticles } from './FloatingParticles.jsx';
import { ParallaxLayer } from './MouseParallax.jsx';

/** Composed depth stack: mesh, grid, beams, circles, particles, noise. */
export function BackgroundEffects() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* mesh gradient blobs — slowest layer */}
      <ParallaxLayer depth={14} className="absolute inset-0">
        <motion.div
          className="absolute rounded-full"
          style={{
            left: '-15%', top: '-10%',
            width: '46rem', height: '46rem',
            filter: 'blur(80px)',
            background: 'var(--auth-mesh-blue)',
          }}
          animate={{ x: [0, 60, 0], y: [0, 40, 0], scale: [1, 1.08, 1] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            bottom: '-20%', left: '25%',
            width: '38rem', height: '38rem',
            filter: 'blur(80px)',
            background: 'var(--auth-mesh-emerald)',
          }}
          animate={{ x: [0, -50, 0], y: [0, -30, 0], scale: [1.05, 1, 1.05] }}
          transition={{ duration: 42, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            right: '-10%', top: '30%',
            width: '32rem', height: '32rem',
            filter: 'blur(80px)',
            background: 'var(--auth-mesh-warm)',
          }}
          animate={{ x: [0, -40, 0], y: [0, 50, 0] }}
          transition={{ duration: 50, repeat: Infinity, ease: 'easeInOut' }}
        />
      </ParallaxLayer>

      {/* grid */}
      <ParallaxLayer depth={26} className="absolute inset-0">
        <AnimatedGrid />
      </ParallaxLayer>

      {/* light beams */}
      <ParallaxLayer depth={40} className="absolute inset-0">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              top: '-30%',
              height: '160%',
              width: '14rem',
              left: `${8 + i * 26}%`,
              transform: 'rotate(-12deg)',
              background: 'linear-gradient(to bottom, transparent, var(--auth-beam), transparent)',
            }}
            animate={{ opacity: [0, 0.75, 0], x: [-40, 60, -40] }}
            transition={{ duration: 22 + i * 7, repeat: Infinity, ease: 'easeInOut', delay: i * 4 }}
          />
        ))}
      </ParallaxLayer>

      {/* parallax outline circles */}
      <ParallaxLayer depth={64} className="absolute inset-0">
        {[
          { size: 620, left: '6%',  top: '12%' },
          { size: 380, left: '48%', top: '52%' },
          { size: 240, left: '30%', top: '72%' },
        ].map((c, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full border"
            style={{
              width: c.size, height: c.size,
              left: c.left, top: c.top,
              borderColor: 'var(--auth-ring-faint)',
            }}
            animate={{ scale: [1, 1.04, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 18 + i * 6, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </ParallaxLayer>

      {/* particles + connective lines */}
      <ParallaxLayer depth={90} className="absolute inset-0">
        <FloatingParticles />
      </ParallaxLayer>

      {/* noise texture */}
      <div className="auth-noise-overlay absolute inset-0" />
    </div>
  );
}
