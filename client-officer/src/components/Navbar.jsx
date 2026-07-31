import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../hooks/useAuth';
import {
  getOfficerNotifications,
  markOfficerNotificationRead,
  markAllOfficerNotificationsRead,
} from '../services/notificationService.js';

function Navbar() {
  const { officer, logout } = useAuth();

  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread]               = useState(0);
  const [bellOpen, setBellOpen]           = useState(false);
  const bellRef                           = useRef(null);

  const fetchNotifs = async () => {
    try {
      const data = await getOfficerNotifications();
      setNotifications(data);
      setUnread(data.filter(n => !n.read).length);
    } catch (e) { console.error('Failed to load notifications', e); }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) setBellOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMarkRead = async (id) => {
    await markOfficerNotificationRead(id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = async () => {
    await markAllOfficerNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  };

  const timeAgo = (ts) => {
    const diff = Math.floor((Date.now() - new Date(ts)) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h ago`;
    return `${Math.floor(diff / 1440)}d ago`;
  };

  return (
    <nav className="scr-navbar">
      {/* ── Left: Brand ── */}
      <div className="d-flex align-items-center gap-3">
        <Link to="/dashboard" className="navbar-brand">
          <div className="scr-brand-icon"><i className="bi bi-building-fill" /></div>
          <span className="brand-text">
            <span className="brand-civic">Civic</span><span className="brand-sense">Sense</span><span className="brand-ai-tag"> AI</span>
          </span>
        </Link>
        <span className="scr-officer-badge">Officer Portal</span>
      </div>

      {/* ── Right: Actions ── */}
      <div className="d-flex align-items-center gap-3">
        {/* Officer avatar dropdown */}
        <div className="dropdown">
          <button
            className="btn btn-link p-0 d-flex align-items-center gap-2 text-decoration-none"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            id="officerDropdown"
            style={{ color: 'var(--o-text)' }}
          >
            <img src={officer?.avatar} alt={officer?.name} className="nav-avatar" style={{ borderRadius: 9 }} />
            <div className="d-none d-md-block text-start">
              <div style={{ fontSize: '.84rem', fontWeight: 600, lineHeight: 1.2, color: 'var(--o-text)' }}>{officer?.name}</div>
              <div style={{ fontSize: '.72rem', color: 'var(--o-text-3)' }}>{officer?.designation}</div>
            </div>
            <i className="bi bi-chevron-down" style={{ fontSize: '.65rem', color: 'var(--o-text-3)' }} />
          </button>

          <ul className="dropdown-menu dropdown-menu-end shadow" aria-labelledby="officerDropdown">
            <li>
              <div className="px-3 py-2" style={{ borderBottom: '1px solid var(--o-border)' }}>
                <div style={{ fontWeight: 700, fontSize: '.9rem' }}>{officer?.name}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--o-text-3)' }}>{officer?.designation}</div>
                <div style={{ fontSize: '.75rem', color: 'var(--o-text-3)' }}>{officer?.department}</div>
              </div>
            </li>
            <li>
              <button className="dropdown-item d-flex align-items-center gap-2 mt-1" onClick={logout} style={{ color: 'var(--o-red)' }}>
                <i className="bi bi-box-arrow-right" /> Logout
              </button>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
