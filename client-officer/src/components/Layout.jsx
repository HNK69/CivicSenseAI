import React from 'react';
import { Outlet } from 'react-router-dom';
import Navbar from './Navbar.jsx';
import Sidebar from './Sidebar.jsx';

/**
 * Layout — shell that wraps every page with Navbar + Sidebar.
 * React Router's <Outlet /> renders the active page component.
 *
 * All routes in routes.jsx are nested under this Layout,
 * so every page automatically gets the nav chrome.
 */
function Layout() {
  return (
    <>
      {/* Fixed top navbar */}
      <Navbar />

      {/* Fixed left sidebar */}
      <Sidebar />

      {/* Scrollable main content area */}
      <main className="scr-main-content">
        <Outlet />
      </main>
    </>
  );
}

export default Layout;
