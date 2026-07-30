import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import Layout                from './components/Layout.jsx';
import Dashboard             from './pages/Dashboard.jsx';
import AIInvestigation       from './pages/AIInvestigation.jsx';
import IssueDashboard        from './pages/IssueDashboard.jsx';
import DuplicateMerge        from './pages/DuplicateMerge.jsx';
import SmartPriority         from './pages/SmartPriority.jsx';
import AssignWork            from './pages/AssignWork.jsx';
import RepairVerification    from './pages/RepairVerification.jsx';
import ContractorPerformance from './pages/ContractorPerformance.jsx';
import MunicipalCopilot      from './pages/MunicipalCopilot.jsx';

/**
 * Centralized React Router v6 route config.
 * All pages are children of Layout (which renders Navbar + Sidebar + <Outlet />).
 *
 * Add a new page:
 *  1. Create src/pages/YourPage.jsx
 *  2. Import above and add { path: 'your-path', element: <YourPage /> } to children
 */
const router = createBrowserRouter([
  {
    path:     '/',
    element:  <Layout />,
    children: [
      { index: true,                    element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard',              element: <Dashboard /> },
      { path: 'ai-investigation',       element: <AIInvestigation /> },
      { path: 'issues',                 element: <IssueDashboard /> },
      { path: 'duplicates',             element: <DuplicateMerge /> },
      { path: 'priority',               element: <SmartPriority /> },
      { path: 'assign-work',            element: <AssignWork /> },
      { path: 'repair-verification',    element: <RepairVerification /> },
      { path: 'contractor-performance', element: <ContractorPerformance /> },
      { path: 'copilot',                element: <MunicipalCopilot /> },
    ],
  },
]);

export default router;
