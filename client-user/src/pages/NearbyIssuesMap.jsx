import { Container, Card, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import { motion } from 'framer-motion';
import MapView from '../components/MapView.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import useFetch from '../hooks/useFetch.js';
import useGeolocation from '../hooks/useGeolocation.js';
import { getNearbyIssues } from '../services/mapService.js';
import { categoryIconMap } from '../utils/statusColorMap.js';
import { DEFAULT_COORDS } from '../utils/constants.js';
import BackButton from '../components/BackButton.jsx';

const severityColorHex = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

const NearbyIssuesMap = () => {
  const { coords, loading: gpsLoading } = useGeolocation();
  const center = coords ? [coords.latitude, coords.longitude] : DEFAULT_COORDS;

  const { data: issues, loading, error, refetch } =
    useFetch(() => getNearbyIssues(center[0], center[1], 2), [coords?.latitude]);

  const counts = { high: 0, medium: 0, low: 0 };
  (issues || []).forEach(i => { if (counts[i.severity] !== undefined) counts[i.severity]++; });

  return (
    <>
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <h1><i className="bi bi-map-fill" />Nearby Civic Issues</h1>
          <p>Issues reported within 2 km of your current location.</p>
        </Container>
      </div>

      <Container className="py-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          <Row className="g-4">

            {/* Map column */}
            <Col xs={12} lg={8}>
              <Card className="feature-card">
                <Card.Body className="p-3">
                  {gpsLoading && (
                    <div
                      style={{
                        background: 'var(--civic-blue-light)',
                        border: '1px solid var(--civic-blue-muted)',
                        borderRadius: 9,
                        padding: '10px 14px',
                        fontSize: '.83rem',
                        color: 'var(--civic-blue)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        marginBottom: 12,
                      }}
                    >
                      <Spinner animation="border" size="sm" />
                      Detecting your location for accurate results…
                    </div>
                  )}

                  {loading ? (
                    <div className="text-center py-5">
                      <Spinner animation="border" variant="primary" />
                      <p style={{ color: 'var(--text-muted)', marginTop: 10, fontSize: '.875rem' }}>Loading map…</p>
                    </div>
                  ) : error ? (
                    <Alert variant="danger" style={{ borderRadius: 10 }}>
                      {error} — <button className="btn btn-link p-0" onClick={refetch}>Retry</button>
                    </Alert>
                  ) : (
                    <MapView center={center} zoom={14} issues={issues || []} height="420px" showRadius />
                  )}

                  {/* Legend */}
                  <div className="d-flex gap-4 flex-wrap mt-3" style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                    {Object.entries(severityColorHex).map(([sev, color]) => (
                      <span key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, display: 'inline-block' }} />
                        <strong style={{ textTransform: 'capitalize' }}>{sev}</strong>
                        <span
                          style={{
                            background: 'var(--bg-elevated)', border: '1px solid var(--border-base)',
                            borderRadius: 10, padding: '1px 7px', fontSize: '.68rem',
                          }}
                        >
                          {counts[sev]}
                        </span>
                      </span>
                    ))}
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                      <span style={{
                        width: 12, height: 12, borderRadius: '50%',
                        background: 'var(--civic-blue)', border: '2px solid #fff',
                        boxShadow: '0 0 0 4px rgba(37,99,235,.2)', display: 'inline-block',
                      }} />
                      You
                    </span>
                  </div>
                </Card.Body>
              </Card>
            </Col>

            {/* Issue list */}
            <Col xs={12} lg={4}>
              <Card className="feature-card h-100">
                <Card.Body className="p-3">
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: '.95rem',
                      fontFamily: 'Space Grotesk, sans-serif',
                      marginBottom: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    Nearby Issues
                    <Badge pill bg="primary" style={{ fontSize: '.68rem' }}>{(issues || []).length}</Badge>
                  </div>

                  {loading ? (
                    <div className="text-center py-4"><Spinner animation="border" size="sm" /></div>
                  ) : (issues || []).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '.83rem', padding: '20px 0' }}>
                      No issues found nearby.
                    </p>
                  ) : (
                    <div style={{ maxHeight: 390, overflowY: 'auto' }}>
                      {(issues || []).map(issue => (
                        <div key={issue.id} className="report-item" id={`nearby-issue-${issue.id}`}>
                          <div className="report-icon flex-shrink-0" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                            <i className={`bi ${categoryIconMap[issue.category] ?? 'bi-three-dots'}`} />
                          </div>
                          <div className="flex-grow-1 min-w-0">
                            <div style={{ fontWeight: 600, fontSize: '.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {issue.title}
                            </div>
                            <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 1 }}>{issue.category}</div>
                          </div>
                          <span
                            style={{
                              background: severityColorHex[issue.severity] ?? 'var(--text-muted)',
                              color: '#fff',
                              borderRadius: 6,
                              padding: '2px 8px',
                              fontSize: '.67rem',
                              fontWeight: 600,
                              textTransform: 'capitalize',
                              flexShrink: 0,
                            }}
                          >
                            {issue.severity}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </motion.div>
      </Container>
    </>
  );
};

export default NearbyIssuesMap;
