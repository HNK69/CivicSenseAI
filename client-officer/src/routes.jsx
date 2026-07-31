import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';

import Layout                from './components/Layout.jsx';
import ProtectedRoute        from './components/ProtectedRoute.jsx';
import LoginPage             from './pages/LoginPage.jsx';
import Dashboard             from './pages/Dashboard.jsx';
import AIInvestigation       from './pages/AIInvestigation.jsx';
import IssueDashboard        from './pages/IssueDashboard.jsx';
import DuplicateMerge        from './pages/DuplicateMerge.jsx';
import SmartPriority         from './pages/SmartPriority.jsx';
import AssignWork            from './pages/AssignWork.jsx';
import RepairVerification    from './pages/RepairVerification.jsx';
import ContractorPerformance from './pages/ContractorPerformance.jsx';
import MunicipalCopilot      from './pages/MunicipalCopilot.jsx';
import ContractorDashboard   from './pages/ContractorDashboard.jsx';

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/contractor',
    element: <ContractorDashboard />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <Layout />
      </ProtectedRoute>
    ),
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
  {
    path: '*',
    element: <Navigate to="/login" replace />,
  },
]);

export default router;
