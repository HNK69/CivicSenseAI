import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Badge, Spinner, Alert } from 'react-bootstrap';
import { motion } from 'framer-motion';
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

const stagger = {
  animate: { transition: { staggerChildren: 0.07 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

const Dashboard = () => {
  const navigate                            = useNavigate();
  const { user }                            = useAuth();
  const { notifications, unreadCount, markRead } = useNotificationContext();

  const { data: issues,   loading: issuesLoading }  = useFetch(getMyIssues, []);
  const { data: verified, loading: verifyLoading }  = useFetch(getPendingVerifications, []);

  const recentIssues   = (issues   || []).slice(0, 3);
  const pendingVerify  = (verified || []).length;
  const recentNotifs   = (notifications || []).slice(0, 3);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      {/* ── Hero Banner ── */}
      <div
        style={{
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-base)',
          padding: '2rem 0 2.2rem',
        }}
      >
        <Container>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="d-flex align-items-center gap-3 mb-1">
              <span style={{ fontSize: '1.7rem' }}>👋</span>
              <div>
                <h1 style={{ fontSize: '1.55rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, marginBottom: 2 }}>
                  {greeting}, {user?.name?.split(' ')[0] ?? 'Citizen'}
                </h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '.875rem', margin: 0 }}>
                  {user?.ward && <><strong style={{ color: 'var(--civic-blue)' }}>{user.ward}</strong>{user?.city ? ` · ${user.city}` : ''} · </>}
                  Report issues. Track progress. Make your city better.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Quick stats strip */}
          <motion.div
            className="d-flex flex-wrap gap-3 mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, duration: 0.3 }}
          >
            {[
              { label: 'Submitted',  value: (issues || []).length,                                       color: 'var(--civic-blue)' },
              { label: 'In Progress', value: (issues || []).filter(i => i.status === 'in_progress').length, color: 'var(--orange)' },
              { label: 'Resolved',   value: (issues || []).filter(i => i.status === 'resolved').length,   color: 'var(--green)' },
              { label: 'Unread',     value: unreadCount,                                                   color: 'var(--red)' },
            ].map(s => (
              <div
                key={s.label}
                style={{
                  background: 'var(--bg-base)',
                  border: '1px solid var(--border-base)',
                  borderRadius: 10,
                  padding: '8px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: s.color, fontFamily: 'Space Grotesk, sans-serif' }}>
                  {issuesLoading ? '–' : s.value}
                </span>
                <span style={{ fontSize: '.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
              </div>
            ))}
          </motion.div>
        </Container>
      </div>

      {/* ── Cards Grid ── */}
      <Container className="py-4">
        <motion.div variants={stagger} initial="initial" animate="animate">
          <Row className="g-4">

            {/* Card 1 — Report Issue */}
            <Col xs={12} md={6} lg={4}>
              <motion.div variants={fadeUp} style={{ height: '100%' }}>
                <FeatureCard
                  icon="bi-plus-circle-fill"
                  iconClass="ci-blue"
                  title="Report an Issue"
                  description="Spotted a problem? Report it with photos, video, or voice — and share your GPS location."
                  actionLabel="Report New Issue"
                  onAction={() => navigate('/report')}
                />
              </motion.div>
            </Col>

            {/* Card 2 — Track Status */}
            <Col xs={12} md={6} lg={4}>
              <motion.div variants={fadeUp} style={{ height: '100%' }}>
                <FeatureCard
                  icon="bi-list-check"
                  iconClass="ci-orange"
                  title="Track Status"
                  description="Monitor all your submitted issues and see real-time status updates."
                  actionLabel="View All My Reports"
                  onAction={() => navigate('/status')}
                >
                  {issuesLoading ? (
                    <div className="text-center py-2"><Spinner animation="border" size="sm" variant="primary" /></div>
                  ) : (
                    <div style={{ minWidth: 0 }}>
                      {recentIssues.length === 0 ? (
                        <p style={{ fontSize: '.82rem', color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>
                          No reports yet.
                        </p>
                      ) : recentIssues.map(issue => (
                        <div key={issue.id || issue._id} className="report-item" style={{ minWidth: 0 }}>
                          <div className="report-icon flex-shrink-0 ci-orange">
                            <i className={`bi ${categoryIconMap[issue.category?.toLowerCase()] ?? 'bi-three-dots'}`} />
                          </div>
                          <div className="flex-grow-1 min-w-0">
                            <div style={{ fontWeight: 600, fontSize: '.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {issue.title}
                            </div>
                            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>{timeAgo(issue.createdAt)}</div>
                          </div>
                          <StatusBadge status={issue.status} size="sm" />
                        </div>
                      ))}
                    </div>
                  )}
                </FeatureCard>
              </motion.div>
            </Col>

            {/* Card 3 — Verify Repair */}
            <Col xs={12} md={6} lg={4}>
              <motion.div variants={fadeUp} style={{ height: '100%' }}>
                <FeatureCard
                  icon="bi-patch-check-fill"
                  iconClass="ci-green"
                  title="Verify Repair"
                  description="Completed repairs are waiting for your confirmation. Mark them fixed — or re-open."
                  actionLabel="Review Repairs"
                  onAction={() => navigate('/verify')}
                  badge={
                    pendingVerify > 0 && (
                      <Badge
                        pill
                        style={{ background: 'var(--green)', fontSize: '.68rem', fontWeight: 600 }}
                      >
                        {pendingVerify} pending
                      </Badge>
                    )
                  }
                >
                  {verifyLoading ? (
                    <div className="text-center py-2"><Spinner animation="border" size="sm" variant="success" /></div>
                  ) : pendingVerify === 0 ? (
                    <div className="text-center py-2" style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                      <i className="bi bi-check-circle-fill d-block mb-1" style={{ fontSize: '1.5rem', color: 'var(--green)' }} />
                      All repairs verified!
                    </div>
                  ) : (
                    <div
                      style={{
                        background: 'var(--green-bg)',
                        border: '1px solid #bbf7d0',
                        borderRadius: 9,
                        padding: '10px 14px',
                        fontSize: '.82rem',
                        color: '#15803d',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <i className="bi bi-bell-fill" />
                      {pendingVerify} issue{pendingVerify > 1 ? 's' : ''} awaiting your confirmation.
                    </div>
                  )}
                </FeatureCard>
              </motion.div>
            </Col>

            {/* Card 4 — Nearby Issues Map */}
            <Col xs={12} md={6} lg={4}>
              <motion.div variants={fadeUp} style={{ height: '100%' }}>
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
                      height: 120,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: 'linear-gradient(160deg, #ede9fe 0%, #dbeafe 100%)',
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {[20, 50, 80].map(p => (
                      <div key={`h${p}`} style={{ position: 'absolute', top: `${p}%`, width: '100%', height: 1, background: 'rgba(255,255,255,.5)' }} />
                    ))}
                    {[25, 50, 75].map(p => (
                      <div key={`v${p}`} style={{ position: 'absolute', left: `${p}%`, height: '100%', width: 1, background: 'rgba(255,255,255,.5)' }} />
                    ))}
                    {[
                      { top: '32%', left: '55%', color: '#ef4444' },
                      { top: '58%', left: '28%', color: '#f59e0b' },
                      { top: '22%', left: '70%', color: '#22c55e' },
                      { top: '68%', left: '62%', color: '#f59e0b' },
                    ].map((pin, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.08, type: 'spring', stiffness: 400 }}
                        style={{
                          position: 'absolute', top: pin.top, left: pin.left,
                          width: 11, height: 11, borderRadius: '50%',
                          background: pin.color, border: '2px solid #fff',
                          boxShadow: '0 2px 5px rgba(0,0,0,.2)',
                        }}
                      />
                    ))}
                    <div style={{
                      width: 16, height: 16, borderRadius: '50%',
                      background: 'var(--civic-blue)', border: '3px solid #fff',
                      boxShadow: '0 0 0 6px rgba(37,99,235,.18)', zIndex: 2,
                    }} />
                  </div>
                  <div className="d-flex gap-3 mt-2 flex-wrap" style={{ fontSize: '.73rem', color: 'var(--text-muted)' }}>
                    {[{ label: 'High', color: '#ef4444' }, { label: 'Medium', color: '#f59e0b' }, { label: 'Low', color: '#22c55e' }].map(l => (
                      <span key={l.label}>
                        <span className="legend-dot" style={{ background: l.color }} />
                        {l.label}
                      </span>
                    ))}
                  </div>
                </FeatureCard>
              </motion.div>
            </Col>

            {/* Card 5 — Notifications */}
            <Col xs={12} md={6} lg={4}>
              <motion.div variants={fadeUp} style={{ height: '100%' }}>
                <FeatureCard
                  icon="bi-bell-fill"
                  iconClass="ci-teal"
                  title="Notifications"
                  description="Stay updated on your issues and civic alerts in your ward."
                  actionLabel="View All Notifications"
                  onAction={() => navigate('/notifications')}
                  badge={
                    unreadCount > 0 && (
                      <Badge pill style={{ background: 'var(--red)', fontSize: '.68rem', fontWeight: 600 }}>
                        {unreadCount} new
                      </Badge>
                    )
                  }
                >
                  <div>
                    {recentNotifs.map(n => (
                      <NotificationItem key={n.id} notification={n} onMarkRead={markRead} />
                    ))}
                    {recentNotifs.length === 0 && (
                      <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '.82rem', padding: '8px 0' }}>
                        No notifications yet.
                      </p>
                    )}
                  </div>
                </FeatureCard>
              </motion.div>
            </Col>

          </Row>
        </motion.div>
      </Container>
    </>
  );
};

export default Dashboard;
