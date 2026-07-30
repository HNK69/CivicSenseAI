import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { NAV_ROUTES } from '../utils/constants';

function Sidebar() {
  return (
    <nav className="scr-sidebar">
      <div className="scr-sidebar-label">Navigation</div>

      <ul className="nav flex-column gap-0" style={{ padding: '4px 0' }}>
        {NAV_ROUTES.map((route, idx) => (
          <li className="nav-item" key={route.path}>
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.2 }}
            >
              <NavLink
                to={route.path}
                className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
              >
                <i className={`bi ${route.icon}`} />
                <span>{route.label}</span>
              </NavLink>
            </motion.div>
          </li>
        ))}
      </ul>

      <div className="scr-sidebar-footer">
        CivicSense AI · Officer v1.0
      </div>
    </nav>
  );
}

export default Sidebar;
