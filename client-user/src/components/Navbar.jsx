import { useNavigate } from 'react-router-dom';
import { Navbar, Container, Dropdown } from 'react-bootstrap';
import useAuth from '../hooks/useAuth.js';
import { useNotificationContext } from '../context/NotificationContext.jsx';

/**
 * Navbar.jsx — Top application navbar.
 * - CivicSense AI logo + brand name
 * - Notification bell with unread badge
 * - User avatar dropdown (Profile, Logout)
 */
const AppNavbar = () => {
  const { user, logout }        = useAuth();
  const { unreadCount }         = useNotificationContext();
  const navigate                = useNavigate();

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : 'CZ';

  return (
    <Navbar className="civic-navbar px-3 px-md-4" expand="lg" fixed="top">
      <Container fluid>
        {/* ---- Brand ---- */}
        <Navbar.Brand
          className="civic-brand d-flex align-items-center gap-2"
          onClick={() => navigate('/')}
          style={{ cursor: 'pointer' }}
        >
          <div className="brand-icon">
            <i className="bi bi-building-fill text-white" />
          </div>
          <span>
            CivicSense <span style={{ color: '#93c5fd' }}>AI</span>
          </span>
        </Navbar.Brand>

        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* ---- Notification Bell ---- */}
          <button
            className="nav-bell position-relative"
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            id="nav-notifications-btn"
          >
            <i className="bi bi-bell-fill" />
            {unreadCount > 0 && (
              <span className="badge bg-danger bell-badge" id="notif-badge">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* ---- User Avatar Dropdown ---- */}
          <Dropdown align="end">
            <Dropdown.Toggle
              as="div"
              className="nav-avatar"
              id="user-avatar-dropdown"
              style={{ border: 'none', background: 'none', padding: 0 }}
            >
              <div className="nav-avatar">{initials}</div>
            </Dropdown.Toggle>

            <Dropdown.Menu className="shadow border-0 rounded-3 mt-2" style={{ minWidth: 200 }}>
              {/* User info header */}
              <div className="px-3 py-2 border-bottom">
                <div className="fw-bold text-dark" style={{ fontSize: '.9rem' }}>
                  {user?.name || 'Citizen'}
                </div>
                <div className="text-muted" style={{ fontSize: '.78rem' }}>
                  {user?.ward} · {user?.city}
                </div>
              </div>

              <Dropdown.Item
                className="d-flex align-items-center gap-2 py-2"
                id="nav-profile-link"
                onClick={() => navigate('/')}
              >
                <i className="bi bi-person-circle text-primary" />
                Profile
              </Dropdown.Item>

              <Dropdown.Item
                className="d-flex align-items-center gap-2 py-2"
                id="nav-settings-link"
                onClick={() => navigate('/')}
              >
                <i className="bi bi-gear text-secondary" />
                Settings
              </Dropdown.Item>

              <Dropdown.Divider />

              <Dropdown.Item
                className="d-flex align-items-center gap-2 py-2 text-danger"
                id="nav-logout-btn"
                onClick={logout}
              >
                <i className="bi bi-box-arrow-right" />
                Logout
              </Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>
        </div>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;
