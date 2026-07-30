import { useNavigate, useLocation } from 'react-router-dom';
import { Navbar, Container, Dropdown } from 'react-bootstrap';
import { motion } from 'framer-motion';
import useAuth from '../hooks/useAuth.js';
import { useNotificationContext } from '../context/NotificationContext.jsx';

const NAV_LINKS = [
  { path: '/dashboard',     label: 'Home',          icon: 'bi-house' },
  { path: '/report',        label: 'Report',        icon: 'bi-plus-circle' },
  { path: '/status',        label: 'My Reports',    icon: 'bi-list-check' },
  { path: '/map',           label: 'Nearby',        icon: 'bi-map' },
  { path: '/verify',        label: 'Verify',        icon: 'bi-patch-check' },
];

const AppNavbar = () => {
  const { user, logout }    = useAuth();
  const { unreadCount }     = useNotificationContext();
  const navigate            = useNavigate();
  const location            = useLocation();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'CZ';

  return (
    <Navbar className="civic-navbar px-3 px-md-4" expand="lg" fixed="top">
      <Container fluid>
        {/* ── Brand ── */}
        <Navbar.Brand
          className="civic-brand d-flex align-items-center gap-2"
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
        >
          <motion.div
            className="brand-icon"
            whileHover={{ scale: 1.08 }}
            transition={{ type: 'spring', stiffness: 400 }}
          >
            <i className="bi bi-building-fill" />
          </motion.div>
          <span className="brand-text">
            <span className="brand-civic">Civic</span><span className="brand-sense">Sense</span><span className="brand-ai-tag"> AI</span>
          </span>
        </Navbar.Brand>

        {/* ── Desktop nav links ── */}
        <div className="d-none d-lg-flex align-items-center gap-1 ms-4">
          {NAV_LINKS.map(link => {
            const isActive = location.pathname === link.path ||
              (link.path !== '/dashboard' && location.pathname.startsWith(link.path));
            return (
              <motion.button
                key={link.path}
                onClick={() => navigate(link.path)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  background: isActive ? 'var(--civic-blue-light)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  padding: '6px 14px',
                  fontSize: '.84rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--civic-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all .15s ease',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <i className={`bi ${link.icon}`} style={{ fontSize: '.9rem' }} />
                {link.label}
              </motion.button>
            );
          })}
        </div>

        {/* ── Right actions ── */}
        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* Bell */}
          <motion.button
            className="nav-bell position-relative"
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            id="nav-notifications-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <i className="bi bi-bell" />
            {unreadCount > 0 && (
              <motion.span
                className="badge bell-badge"
                id="notif-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500 }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </motion.button>

          {/* Avatar dropdown */}
          <Dropdown align="end">
            <Dropdown.Toggle
              as="div"
              id="user-avatar-dropdown"
              style={{
                border: 'none',
                background: 'none',
                padding: 0,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <motion.div
                className="nav-avatar"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {initials}
              </motion.div>
            </Dropdown.Toggle>

            <Dropdown.Menu className="shadow mt-2" style={{ minWidth: 210 }}>
              <div className="px-3 py-2 mb-1" style={{ borderBottom: '1px solid var(--border-base)' }}>
                <div className="fw-bold" style={{ fontSize: '.9rem', color: 'var(--text-primary)' }}>
                  {user?.name || 'Citizen'}
                </div>
                <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>
                  {user?.ward}{user?.city ? ` · ${user.city}` : ''}
                </div>
              </div>
              <Dropdown.Item className="d-flex align-items-center gap-2" onClick={() => navigate('/')} id="nav-profile-link">
                <i className="bi bi-person" style={{ color: 'var(--civic-blue)' }} />Profile
              </Dropdown.Item>
              <Dropdown.Item className="d-flex align-items-center gap-2" onClick={() => navigate('/')} id="nav-settings-link">
                <i className="bi bi-gear" style={{ color: 'var(--text-muted)' }} />Settings
              </Dropdown.Item>
              <Dropdown.Divider />
              <Dropdown.Item className="d-flex align-items-center gap-2" style={{ color: 'var(--red)' }} onClick={logout} id="nav-logout-btn">
                <i className="bi bi-box-arrow-right" />Logout
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;
