import { Container, Card, Button, Spinner, Badge, ButtonGroup, Alert } from 'react-bootstrap';
import NotificationItem from '../components/NotificationItem.jsx';
import { useNotificationContext } from '../context/NotificationContext.jsx';
import BackButton from '../components/BackButton.jsx';

/**
 * Notifications.jsx — Full notification history page.
 * Unread notifications are highlighted; click to mark read.
 */

const TYPE_FILTERS = [
  { key: 'all',           label: 'All' },
  { key: 'status_update', label: 'Status Updates' },
  { key: 'verify_request', label: 'Verify Requests' },
  { key: 'alert',         label: 'Alerts' },
];

const Notifications = () => {
  const { notifications, unreadCount, loading, markAllRead, markRead, fetchNotifications } =
    useNotificationContext();

  return (
    <>
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
            <div>
              <h1 className="mb-1">
                <i className="bi bi-bell-fill me-2" />Notifications
              </h1>
              <p className="mb-0">Your civic alerts and issue status updates.</p>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="light"
                size="sm"
                className="fw-semibold rounded-pill"
                onClick={markAllRead}
                id="mark-all-read-btn"
                style={{ fontSize: '.82rem' }}
              >
                <i className="bi bi-check2-all me-1" />
                Mark all as read ({unreadCount})
              </Button>
            )}
          </div>
        </Container>
      </div>

      <Container className="py-5" style={{ maxWidth: 780 }}>
        <Card className="feature-card border-0">
          <Card.Body className="p-4">

            {/* ---- Header stats ---- */}
            <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-3">
              <div className="d-flex gap-3" style={{ fontSize: '.82rem', color: '#64748b' }}>
                <span>
                  <strong>{notifications.length}</strong> total
                </span>
                {unreadCount > 0 && (
                  <span>
                    <Badge bg="primary" pill>{unreadCount}</Badge>&nbsp;unread
                  </span>
                )}
              </div>
              <Button
                variant="outline-secondary"
                size="sm"
                className="rounded-pill"
                onClick={fetchNotifications}
                disabled={loading}
                id="refresh-notifs-btn"
                style={{ fontSize: '.78rem' }}
              >
                <i className={`bi bi-arrow-clockwise me-1 ${loading ? 'spin' : ''}`} />
                Refresh
              </Button>
            </div>

            {/* ---- Content ---- */}
            {loading ? (
              <div className="text-center py-5">
                <Spinner animation="border" variant="primary" />
                <p className="text-muted mt-2 mb-0">Loading notifications…</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="text-center py-5 text-muted">
                <i className="bi bi-bell-slash fs-2 d-block mb-2" />
                <p className="mb-0">No notifications yet.</p>
              </div>
            ) : (
              <div id="notification-list">
                {/* Group by unread / read */}
                {unreadCount > 0 && (
                  <div className="mb-1" style={{ fontSize: '.78rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>
                    Unread
                  </div>
                )}
                {notifications
                  .filter(n => !n.read)
                  .map(n => (
                    <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
                  ))}

                {notifications.some(n => !n.read) && notifications.some(n => n.read) && (
                  <div
                    className="my-3"
                    style={{ fontSize: '.78rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}
                  >
                    Earlier
                  </div>
                )}

                {notifications
                  .filter(n => n.read)
                  .map(n => (
                    <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
                  ))}
              </div>
            )}

          </Card.Body>
        </Card>
      </Container>
    </>
  );
};

export default Notifications;
