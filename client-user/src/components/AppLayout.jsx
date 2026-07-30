import { Outlet } from 'react-router-dom';
import AppNavbar from './Navbar.jsx';

/**
 * AppLayout — Shared layout wrapping all pages.
 * Renders Navbar at top, then the matched page via <Outlet>.
 */
const AppLayout = () => (
  <>
    <AppNavbar />
    <main>
      <Outlet />
    </main>
  </>
);

export default AppLayout;
