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

        {/* Bell */}
        <div className="position-relative" ref={bellRef} id="notification-bell-wrapper">
          <motion.button
            className="scr-bell-btn"
            id="notification-bell-btn"
            onClick={() => setBellOpen(prev => !prev)}
            whileTap={{ scale: 0.93 }}
          >
            <i className="bi bi-bell" />
            {unread > 0 && (
              <motion.span
                className="badge bg-danger scr-notif-badge"
                id="notification-unread-badge"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 500 }}
              >
                {unread > 9 ? '9+' : unread}
              </motion.span>
            )}
          </motion.button>

          {/* Dropdown */}
          <AnimatePresence>
            {bellOpen && (
              <motion.div
                id="notification-dropdown"
                initial={{ opacity: 0, y: -8, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.97 }}
                transition={{ duration: 0.15 }}
                style={{
                  position: 'absolute', right: 0, top: 'calc(100% + 10px)',
                  width: 340, maxHeight: 420, overflowY: 'auto',
                  background: 'var(--o-surface)',
                  borderRadius: 12,
                  boxShadow: 'var(--o-shadow-lg)',
                  zIndex: 1050,
                  border: '1px solid var(--o-border)',
                }}
              >
                {/* Header */}
                <div style={{
                  padding: '12px 16px 10px',
                  borderBottom: '1px solid var(--o-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  position: 'sticky', top: 0, background: 'var(--o-surface)', zIndex: 1,
                }}>
                  <span style={{ fontWeight: 700, fontSize: '.88rem', color: 'var(--o-text)', fontFamily: 'Space Grotesk, sans-serif' }}>
                    Notifications
                    {unread > 0 && (
                      <span className="badge bg-danger ms-2 rounded-pill" style={{ fontSize: '.65rem' }}>{unread}</span>
                    )}
                  </span>
                  {unread > 0 && (
                    <button
                      className="btn btn-link p-0"
                      style={{ fontSize: '.75rem', color: 'var(--o-blue)' }}
                      onClick={handleMarkAllRead}
                      id="mark-all-read-btn"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Items */}
                {notifications.length === 0 ? (
                  <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--o-text-3)', fontSize: '.85rem' }}>
                    No notifications yet.
                  </div>
                ) : notifications.map(n => (
                  <div
                    key={n.id}
                    id={`notif-item-${n.id}`}
                    onClick={() => !n.read && handleMarkRead(n.id)}
                    style={{
                      padding: '11px 16px',
                      borderBottom: '1px solid var(--o-elevated)',
                      background: n.read ? 'transparent' : 'var(--o-blue-light)',
                      cursor: n.read ? 'default' : 'pointer',
                      transition: 'background .15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: n.read ? 500 : 700, fontSize: '.84rem', color: 'var(--o-text)', flex: 1 }}>
                        {!n.read && (
                          <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: 'var(--o-blue)', marginRight: 6, marginBottom: 1 }} />
                        )}
                        {n.title}
                      </span>
                      <span style={{ fontSize: '.7rem', color: 'var(--o-text-3)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {timeAgo(n.timestamp)}
                      </span>
                    </div>
                    {n.detail && (
                      <p style={{ margin: '4px 0 0', fontSize: '.78rem', color: 'var(--o-text-2)', lineHeight: 1.45 }}>
                        {n.detail}
                      </p>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

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
