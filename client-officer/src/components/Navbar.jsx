import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Navbar — fixed top bar with logo, officer info, and notification bell.
 * Reads officer data from AuthContext via useAuth().
 */
function Navbar() {
  const { officer, logout } = useAuth();

  return (
    <nav className="navbar scr-navbar px-3 px-md-4">
      <div className="d-flex align-items-center gap-3">
        {/* Brand / Logo */}
        <Link to="/dashboard" className="navbar-brand text-white d-flex align-items-center gap-2 mb-0">
          <i className="bi bi-building-fill" style={{ fontSize: '1.4rem', color: '#4fc3f7' }}></i>
          <span>
            Smart Civic<span style={{ color: '#4fc3f7', fontWeight: 800 }}> Reporter</span>
          </span>
        </Link>

        <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', fontSize: '0.68rem', fontWeight: 500 }}>
          Officer Portal
        </span>
      </div>

      {/* Right section */}
      <div className="d-flex align-items-center gap-3">
        {/* Notification Bell */}
        <div className="position-relative cursor-pointer" title="Notifications">
          <i className="bi bi-bell-fill text-white" style={{ fontSize: '1.15rem' }}></i>
          {officer?.notifications > 0 && (
            <span
              className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger scr-notif-badge"
              style={{ fontSize: '0.62rem' }}
            >
              {officer.notifications}
            </span>
          )}
        </div>

        {/* Officer avatar + name dropdown */}
        <div className="dropdown">
          <button
            className="btn btn-link p-0 d-flex align-items-center gap-2 text-white text-decoration-none"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            id="officerDropdown"
          >
            <img src={officer?.avatar} alt={officer?.name} className="nav-avatar" />
            <span className="d-none d-md-inline" style={{ fontSize: '0.875rem', fontWeight: 500 }}>
              {officer?.name}
            </span>
            <i className="bi bi-chevron-down" style={{ fontSize: '0.7rem' }}></i>
          </button>

          <ul className="dropdown-menu dropdown-menu-end shadow" aria-labelledby="officerDropdown">
            <li>
              <div className="px-3 py-2">
                <div className="fw-600" style={{ fontSize: '0.9rem' }}>{officer?.name}</div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>{officer?.designation}</div>
                <div className="text-muted" style={{ fontSize: '0.78rem' }}>{officer?.department}</div>
              </div>
            </li>
            <li><hr className="dropdown-divider" /></li>
            <li>
              <button className="dropdown-item d-flex align-items-center gap-2" onClick={logout}>
                <i className="bi bi-box-arrow-right text-danger"></i> Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
