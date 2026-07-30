import { Container, Card, Button, Spinner, Badge } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import NotificationItem from '../components/NotificationItem.jsx';
import { useNotificationContext } from '../context/NotificationContext.jsx';
import BackButton from '../components/BackButton.jsx';

const TYPE_FILTERS = [
  { key: 'all',            label: 'All' },
  { key: 'status_update',  label: 'Status Updates' },
  { key: 'verify_request', label: 'Verify Requests' },
  { key: 'alert',          label: 'Alerts' },
];

const Notifications = () => {
  const { notifications, unreadCount, loading, markAllRead, markRead, fetchNotifications } =
    useNotificationContext();

  const unread = notifications.filter(n => !n.read);
  const read   = notifications.filter(n =>  n.read);

  return (
    <>
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h1><i className="bi bi-bell-fill" />Notifications</h1>
              <p>Your civic alerts and issue status updates.</p>
            </div>
            {unreadCount > 0 && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={markAllRead}
                id="mark-all-read-btn"
                style={{
                  background: 'var(--civic-blue)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '7px 16px',
                  fontSize: '.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <i className="bi bi-check2-all" />
                Mark all read ({unreadCount})
              </motion.button>
            )}
          </div>
        </Container>
      </div>

      <Container className="py-4" style={{ maxWidth: 760 }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>

          {/* Header row */}
          <div className="d-flex align-items-center justify-content-between mb-3">
            <div style={{ fontSize: '.82rem', color: 'var(--text-muted)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{notifications.length}</strong> notifications
              {unreadCount > 0 && (
                <Badge pill bg="primary" className="ms-2" style={{ fontSize: '.68rem' }}>{unreadCount} unread</Badge>
              )}
            </div>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={fetchNotifications}
              disabled={loading}
              id="refresh-notifs-btn"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-base)',
                borderRadius: 8,
                padding: '5px 12px',
                fontSize: '.78rem',
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <i className={`bi bi-arrow-clockwise ${loading ? 'spin' : ''}`} />
              Refresh
            </motion.button>
          </div>

          <Card className="feature-card">
            <Card.Body className="p-4">
              {loading ? (
                <div className="text-center py-5">
                  <Spinner animation="border" variant="primary" />
                  <p style={{ color: 'var(--text-muted)', marginTop: 10, fontSize: '.875rem' }}>Loading…</p>
                </div>
              ) : notifications.length === 0 ? (
                <motion.div className="text-center py-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <i className="bi bi-bell-slash d-block mb-2" style={{ fontSize: '2.5rem', color: 'var(--text-muted)' }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '.875rem' }}>No notifications yet.</p>
                </motion.div>
              ) : (
                <div id="notification-list">
                  {/* Unread group */}
                  {unread.length > 0 && (
                    <>
                      <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
                        Unread · {unread.length}
                      </div>
                      <AnimatePresence>
                        {unread.map(n => (
                          <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
                        ))}
                      </AnimatePresence>
                    </>
                  )}

                  {/* Read group */}
                  {read.length > 0 && (
                    <>
                      <div
                        style={{
                          fontSize: '.72rem', color: 'var(--text-muted)', fontWeight: 700,
                          textTransform: 'uppercase', letterSpacing: '.06em',
                          marginTop: unread.length > 0 ? 20 : 0, marginBottom: 6,
                        }}
                      >
                        Earlier
                      </div>
                      {read.map(n => (
                        <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
                      ))}
                    </>
                  )}
                </div>
              )}
            </Card.Body>
          </Card>
        </motion.div>
      </Container>
    </>
  );
};

export default Notifications;
