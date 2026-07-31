/**
 * motion.js — Animation variants ported from login-ui/src/lib/motion.ts
 * Works with framer-motion (same API as motion/react).
 */

export const ease = [0.22, 1, 0.36, 1];

export const springSoft = {
  type: 'spring',
  stiffness: 220,
  damping: 28,
  mass: 0.9,
};

export const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

export const fadeIn = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.8, ease } },
};

export const stagger = (staggerChildren = 0.08, delayChildren = 0) => ({
  hidden: {},
  visible: { transition: { staggerChildren, delayChildren } },
});

export const wordReveal = {
  hidden: { opacity: 0, y: '0.5em', filter: 'blur(6px)' },
  visible: {
    opacity: 1,
    y: '0em',
    filter: 'blur(0px)',
    transition: { duration: 0.8, ease },
  },
};

export const fieldEnter = {
  hidden: { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.25, ease } },
};

export const shake = {
  idle: { x: 0 },
  shake: { x: [0, -6, 5, -4, 3, 0], transition: { duration: 0.42 } },
};
