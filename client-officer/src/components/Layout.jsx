import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15, ease: 'easeIn' } },
};

/**
 * Layout — shell that wraps every page with Navbar + Sidebar.
 * React Router's <Outlet /> renders the active page component.
 * AnimatePresence provides cross-fade + slide transitions on route changes.
 */
function Layout() {
  const location = useLocation();

  return (
    <>
      {/* Fixed top navbar */}
      <Navbar />

      {/* Fixed left sidebar */}
      <Sidebar />

      {/* Scrollable main content area */}
      <main className="scr-main-content">
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
}

export default Layout;
