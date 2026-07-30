import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import AppNavbar from './Navbar.jsx';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' } },
};

/**
 * AppLayout — Shared layout wrapping all citizen pages.
 * Renders Navbar at top, then the matched page via <Outlet>.
 * AnimatePresence provides cross-fade + slide transitions on route changes.
 */
const AppLayout = () => {
  const location = useLocation();

  return (
    <>
      <AppNavbar />
      <main style={{ paddingTop: 64 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </>
  );
};

export default AppLayout;
