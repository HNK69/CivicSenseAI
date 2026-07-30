import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';
import AppNavbar from './Navbar.jsx';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6,  transition: { duration: 0.15 } },
};

const AppLayout = () => {
  const location = useLocation();
  return (
    <>
      <AppNavbar />
      <main style={{ paddingTop: 'var(--navbar-h)' }}>
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
