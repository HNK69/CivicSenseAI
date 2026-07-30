import React from 'react';
import { NavLink } from 'react-router-dom';
import { NAV_ROUTES } from '../utils/constants';

/**
 * Sidebar — fixed left navigation panel.
 * Uses React Router NavLink for automatic active-state styling (.active class).
 * On mobile (<992px) this panel is hidden via CSS; use the Offcanvas toggle in Navbar.
 *
 * To add a new route: update NAV_ROUTES in utils/constants.js — no changes needed here.
 */
function Sidebar() {
  return (
    <nav className="scr-sidebar d-flex flex-column py-3">
      {/* Section label */}
      <div className="px-3 mb-2">
        <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
          Navigation
        </span>
      </div>

      <ul className="nav flex-column gap-1">
        {NAV_ROUTES.map((route) => (
          <li className="nav-item" key={route.path}>
            <NavLink
              to={route.path}
              className={({ isActive }) =>
                `nav-link${isActive ? ' active' : ''}`
              }
            >
              <i className={`bi ${route.icon}`}></i>
              <span>{route.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>

      {/* Footer info */}
      <div className="mt-auto px-3 py-2" style={{ borderTop: '1px solid rgba(255,255,255,0.1)', marginTop: '16px' }}>
        <small style={{ color: 'rgba(255,255,255,0.35)', fontSize: '0.72rem' }}>
          CivicSense AI v1.0
        </small>
      </div>
    </nav>
  );
}

export default Sidebar;
