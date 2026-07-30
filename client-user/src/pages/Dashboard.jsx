import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Badge, Spinner, Alert } from 'react-bootstrap';
import FeatureCard from '../components/FeatureCard.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import NotificationItem from '../components/NotificationItem.jsx';
import useFetch from '../hooks/useFetch.js';
import useAuth from '../hooks/useAuth.js';
import { useNotificationContext } from '../context/NotificationContext.jsx';
import { getMyIssues } from '../services/issueService.js';
import { getPendingVerifications } from '../services/verifyService.js';
import { categoryIconMap } from '../utils/statusColorMap.js';
import { timeAgo } from '../utils/formatDate.js';

/**
 * Dashboard.jsx — Main citizen landing page.
 * 5 Feature cards in a responsive Bootstrap grid.
 */
const Dashboard = () => {
  const navigate                            = useNavigate();
  const { user }                            = useAuth();
  const { notifications, unreadCount, markRead } = useNotificationContext();

  const { data: issues,   loading: issuesLoading }  = useFetch(getMyIssues, []);
  const { data: verified, loading: verifyLoading }  = useFetch(getPendingVerifications, []);

  const recentIssues   = (issues   || []).slice(0, 3);
  const pendingVerify  = (verified || []).length;
  const recentNotifs   = (notifications || []).slice(0, 4);

  return (
    <>
      {/* ---- Hero strip ---- */}
      <div className="page-hero" style={{ paddingTop: 'calc(64px + 2rem)' }}>
        <Container>
          <div className="d-flex align-items-center gap-3 flex-wrap">
            <div>
              <h1 className="mb-1" style={{ fontSize: '1.7rem' }}>
                Welcome back, {user?.name?.split(' ')[0] ?? 'Citizen'} 👋
              </h1>
              <p className="mb-0" style={{ opacity: .8 }}>
                {user?.ward} · {user?.city} &nbsp;·&nbsp; Report. Track. Verify.
              </p>
            </div>
          </div>
        </Container>
      </div>

      {/* ---- Cards grid ---- */}
      <Container className="py-5">
        <Row className="g-4">

          {/* ---- Card 1: Report Issue ---- */}
          <Col xs={12} md={6} lg={4}>
            <FeatureCard
              icon="bi-camera-fill"
              iconClass="ci-blue"
              title="Report an Issue"
              description="Spotted a problem? Report it with photos, video, or voice—and share your GPS location."
              actionLabel="Report New Issue"
              onAction={() => navigate('/report')}
            />
          </Col>

          {/* ---- Card 2: Track Status ---- */}
          <Col xs={12} md={6} lg={4}>
            <FeatureCard
              icon="bi-list-check"
              iconClass="ci-orange"
              title="Track Status"
              description="Monitor all your submitted issues and see real-time status updates."
              actionLabel="View All My Reports"
              onAction={() => navigate('/status')}
            >
              {issuesLoading ? (
                <div className="text-center py-2"><Spinner animation="border" size="sm" /></div>
              ) : (
                <div>
                  {recentIssues.map(issue => (
                    <div key={issue.id} className="report-item">
                      <div
                        className="report-icon"
                        style={{ background: '#f1f5f9', color: '#64748b' }}
                      >
                        <i className={`bi ${categoryIconMap[issue.category] ?? 'bi-three-dots'}`} />
                      </div>
                      <div className="flex-grow-1 min-w-0">
                        <div className="fw-semibold text-truncate" style={{ fontSize: '.85rem' }}>
                          {issue.title}
                        </div>
                        <div className="text-muted" style={{ fontSize: '.72rem' }}>
                          {timeAgo(issue.createdAt)}
                        </div>
                      </div>
                      <StatusBadge status={issue.status} size="sm" />
                    </div>
                  ))}
                </div>
              )}
            </FeatureCard>
          </Col>

          {/* ---- Card 3: Verify Repair ---- */}
          <Col xs={12} md={6} lg={4}>
            <FeatureCard
              icon="bi-patch-check-fill"
              iconClass="ci-green"
              title="Verify Repair"
              description="Completed repairs are waiting for your confirmation. Mark them fixed—or re-open."
              actionLabel="Review Repairs"
              onAction={() => navigate('/verify')}
              badge={
                pendingVerify > 0 && (
                  <Badge bg="success" pill style={{ fontSize: '.7rem' }}>
                    {pendingVerify} pending
                  </Badge>
                )
              }
            >
              {verifyLoading ? (
                <div className="text-center py-2"><Spinner animation="border" size="sm" /></div>
              ) : pendingVerify === 0 ? (
                <div className="text-center py-2 text-muted" style={{ fontSize: '.83rem' }}>
                  <i className="bi bi-check-circle text-success fs-4 d-block mb-1" />
                  All repairs verified!
                </div>
              ) : (
                <Alert variant="success" className="py-2 px-3 mb-0" style={{ fontSize: '.83rem', borderRadius: 10 }}>
                  <i className="bi bi-bell-fill me-2" />
                  {pendingVerify} issue{pendingVerify > 1 ? 's' : ''} marked Completed — awaiting your confirmation.
                </Alert>
              )}
            </FeatureCard>
          </Col>

          {/* ---- Card 4: Nearby Issues Map ---- */}
          <Col xs={12} md={6} lg={4}>
            <FeatureCard
              icon="bi-map-fill"
              iconClass="ci-purple"
              title="Nearby Issues"
              description="See civic issues reported near you, colour-coded by severity."
              actionLabel="View Full Map"
              onAction={() => navigate('/map')}
            >
              {/* Mini map placeholder */}
              <div
                style={{
                  height: 130, borderRadius: 10, overflow: 'hidden',
                  background: 'linear-gradient(160deg, #dbeafe 0%, #ede9fe 100%)',
                  position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                id="nearbyMap-preview"
              >
                {[20, 50, 80].map(p => (
                  <div key={`h${p}`} style={{ position: 'absolute', top: `${p}%`, width: '100%', height: 1, background: 'rgba(255,255,255,.55)' }} />
                ))}
                {[25, 50, 75].map(p => (
                  <div key={`v${p}`} style={{ position: 'absolute', left: `${p}%`, height: '100%', width: 1, background: 'rgba(255,255,255,.55)' }} />
                ))}
                {/* Fake pins */}
                {[
                  { top: '35%', left: '55%', color: '#ef4444' },
                  { top: '55%', left: '30%', color: '#f59e0b' },
                  { top: '25%', left: '72%', color: '#22c55e' },
                  { top: '65%', left: '60%', color: '#f59e0b' },
                ].map((pin, i) => (
                  <div key={i} style={{
                    position: 'absolute', top: pin.top, left: pin.left,
                    width: 12, height: 12, borderRadius: '50%',
                    background: pin.color, border: '2px solid #fff',
                    boxShadow: '0 2px 5px rgba(0,0,0,.25)',
                  }} />
                ))}
                {/* Centre dot */}
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#1a56db', border: '3px solid #fff',
                  boxShadow: '0 0 0 6px rgba(26,86,219,.18)', zIndex: 2,
                }} />
              </div>

              {/* Legend */}
              <div className="d-flex gap-3 mt-2 flex-wrap" style={{ fontSize: '.75rem', color: '#64748b' }}>
                {[
                  { label: 'High',   color: '#ef4444' },
                  { label: 'Medium', color: '#f59e0b' },
                  { label: 'Low',    color: '#22c55e' },
                ].map(l => (
                  <span key={l.label}>
                    <span className="legend-dot" style={{ background: l.color }} />
                    {l.label}
                  </span>
                ))}
              </div>
            </FeatureCard>
          </Col>

          {/* ---- Card 5: Notifications ---- */}
          <Col xs={12} md={6} lg={4}>
            <FeatureCard
              icon="bi-bell-fill"
              iconClass="ci-teal"
              title="Notifications"
              description="Stay updated on your issues and civic alerts in your ward."
              actionLabel="View All Notifications"
              onAction={() => navigate('/notifications')}
              badge={
                unreadCount > 0 && (
                  <Badge bg="danger" pill style={{ fontSize: '.7rem' }}>
                    {unreadCount} new
                  </Badge>
                )
              }
            >
              <div>
                {recentNotifs.slice(0, 3).map(n => (
                  <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
                ))}
                {recentNotifs.length === 0 && (
                  <p className="text-muted text-center py-2 mb-0" style={{ fontSize: '.83rem' }}>
                    No notifications yet.
                  </p>
                )}
              </div>
            </FeatureCard>
          </Col>

        </Row>
      </Container>
    </>
  );
};

export default Dashboard;
