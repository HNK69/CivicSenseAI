import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getOfficerNotifications,
  markOfficerNotificationRead,
  markAllOfficerNotificationsRead,
} from '../services/notificationService.js';

/**
 * Navbar — fixed top bar with logo, officer info, notification bell dropdown.
 * Bell now shows a dropdown list with title + message description for each notif.
 */
function Navbar() {
  const { officer, logout } = useAuth();

  const [notifications, setNotifications]   = useState([]);
  const [unread, setUnread]                  = useState(0);
  const [bellOpen, setBellOpen]              = useState(false);
  const bellRef                              = useRef(null);

  /* ---- Fetch notifications ---- */
  const fetchNotifs = async () => {
    try {
      const data = await getOfficerNotifications();
      setNotifications(data);
      setUnread(data.filter(n => !n.read).length);
    } catch (e) {
      console.error('Failed to load notifications', e);
    }
  };

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30_000);
    return () => clearInterval(interval);
  }, []);

  /* ---- Close bell dropdown when clicking outside ---- */
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (bellRef.current && !bellRef.current.contains(e.target)) {
        setBellOpen(false);
      }
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
    <nav className="navbar scr-navbar px-3 px-md-4">
      <div className="d-flex align-items-center gap-3">
        {/* Brand / Logo */}
        <Link to="/dashboard" className="navbar-brand text-white d-flex align-items-center gap-2 mb-0">
          <i className="bi bi-building-fill" style={{ fontSize: '1.3rem', color: '#1a56db' }}></i>
          <span>
            CivicSense <span style={{ color: '#93c5fd', fontWeight: 800 }}>AI</span>
          </span>
        </Link>

        <span className="badge" style={{ background: 'rgba(255,255,255,0.15)', fontSize: '0.68rem', fontWeight: 500 }}>
          Officer Portal
        </span>
      </div>

      {/* Right section */}
      <div className="d-flex align-items-center gap-3">

        {/* ===== Notification Bell ===== */}
        <div className="position-relative" ref={bellRef} id="notification-bell-wrapper">
          <button
            className="btn btn-link p-0 text-white position-relative"
            title="Notifications"
            id="notification-bell-btn"
            onClick={() => setBellOpen(prev => !prev)}
            style={{ fontSize: '1.15rem', lineHeight: 1 }}
          >
            <i className="bi bi-bell-fill"></i>
            {unread > 0 && (
              <span
                className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger scr-notif-badge"
                style={{ fontSize: '0.62rem' }}
                id="notification-unread-badge"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Dropdown panel */}
          {bellOpen && (
            <div
              id="notification-dropdown"
              style={{
                position: 'absolute',
                right: 0,
                top: 'calc(100% + 10px)',
                width: 340,
                maxHeight: 420,
                overflowY: 'auto',
                background: '#fff',
                borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,.18)',
                zIndex: 1050,
                border: '1px solid #e8edf3',
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: '12px 16px 8px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  position: 'sticky',
                  top: 0,
                  background: '#fff',
                  zIndex: 1,
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '.9rem', color: '#0a3d62' }}>
                  🔔 Notifications
                  {unread > 0 && (
                    <span
                      className="badge bg-danger ms-2 rounded-pill"
                      style={{ fontSize: '.68rem' }}
                    >
                      {unread}
                    </span>
                  )}
                </span>
                {unread > 0 && (
                  <button
                    className="btn btn-link p-0 text-primary"
                    style={{ fontSize: '.75rem' }}
                    onClick={handleMarkAllRead}
                    id="mark-all-read-btn"
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {/* Notification items */}
              {notifications.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: '#94a3b8', fontSize: '.85rem' }}>
                  No notifications yet.
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    id={`notif-item-${n.id}`}
                    onClick={() => !n.read && handleMarkRead(n.id)}
                    style={{
                      padding: '12px 16px',
                      borderBottom: '1px solid #f8fafc',
                      background: n.read ? '#fff' : '#f0f7ff',
                      cursor: n.read ? 'default' : 'pointer',
                      transition: 'background 0.15s',
                    }}
                  >
                    {/* Title */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <span style={{ fontWeight: n.read ? 500 : 700, fontSize: '.84rem', color: '#1e293b', flex: 1 }}>
                        {!n.read && (
                          <span style={{
                            display: 'inline-block', width: 7, height: 7,
                            borderRadius: '50%', background: '#3b82f6',
                            marginRight: 6, marginBottom: 1,
                          }} />
                        )}
                        {n.title}
                      </span>
                      <span style={{ fontSize: '.7rem', color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {timeAgo(n.timestamp)}
                      </span>
                    </div>

                    {/* Message body / description — this was previously missing */}
                    {n.detail && (
                      <p style={{
                        margin: '4px 0 0',
                        fontSize: '.78rem',
                        color: '#64748b',
                        lineHeight: 1.45,
                      }}>
                        {n.detail}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
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
