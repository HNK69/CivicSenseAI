import { Routes, Route } from 'react-router-dom';
import AppLayout from './components/AppLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import ReportIssue from './pages/ReportIssue.jsx';
import TrackStatus from './pages/TrackStatus.jsx';
import VerifyRepair from './pages/VerifyRepair.jsx';
import NearbyIssuesMap from './pages/NearbyIssuesMap.jsx';
import Notifications from './pages/Notifications.jsx';

/**
 * routes.jsx — Centralised route definitions.
 * All citizen-facing routes are nested under AppLayout
 * (which renders <Navbar> + <Outlet>).
 */
const AppRoutes = () => (
  <Routes>
    <Route element={<AppLayout />}>
      <Route path="/"              element={<Dashboard />} />
      <Route path="/report"        element={<ReportIssue />} />
      <Route path="/status"        element={<TrackStatus />} />
      <Route path="/verify"        element={<VerifyRepair />} />
      <Route path="/map"           element={<NearbyIssuesMap />} />
      <Route path="/notifications" element={<Notifications />} />
    </Route>
  </Routes>
);

export default AppRoutes;
