import { Container, Card, Row, Col, Spinner, Alert, Badge } from 'react-bootstrap';
import MapView from '../components/MapView.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import useFetch from '../hooks/useFetch.js';
import useGeolocation from '../hooks/useGeolocation.js';
import { getNearbyIssues } from '../services/mapService.js';
import { categoryIconMap } from '../utils/statusColorMap.js';

/**
 * NearbyIssuesMap.jsx — Full Leaflet map of nearby reported issues.
 */

const severityColorHex = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

const NearbyIssuesMap = () => {
  const { coords, loading: gpsLoading } = useGeolocation();

  const center = coords
    ? [coords.latitude, coords.longitude]
    : [12.9716, 77.5946]; // Bangalore fallback

  const { data: issues, loading, error, refetch } =
    useFetch(() => getNearbyIssues(center[0], center[1], 2), [coords?.latitude]);

  const counts = { high: 0, medium: 0, low: 0 };
  (issues || []).forEach(i => { if (counts[i.severity] !== undefined) counts[i.severity]++; });

  return (
    <>
      {/* Hero */}
      <div className="page-hero" style={{ paddingTop: 'calc(64px + 2rem)' }}>
        <Container>
          <h1 className="mb-1">
            <i className="bi bi-map-fill me-2" />Nearby Civic Issues
          </h1>
          <p className="mb-0">Issues reported within 2 km of your current location.</p>
        </Container>
      </div>

      <Container className="py-5">
        <Row className="g-4">

          {/* ---- Map column ---- */}
          <Col xs={12} lg={8}>
            <Card className="feature-card border-0">
              <Card.Body className="p-3">

                {/* GPS status */}
                {gpsLoading && (
                  <Alert variant="info" className="py-2 mb-3" style={{ fontSize: '.83rem', borderRadius: 8 }}>
                    <Spinner animation="border" size="sm" className="me-2" />
                    Detecting your location for accurate results…
                  </Alert>
                )}

                {/* Map */}
                {loading ? (
                  <div className="text-center py-5">
                    <Spinner animation="border" variant="primary" />
                    <p className="text-muted mt-2 mb-0">Loading map…</p>
                  </div>
                ) : error ? (
                  <Alert variant="danger">
                    {error} — <button className="btn btn-link p-0" onClick={refetch}>Retry</button>
                  </Alert>
                ) : (
                  <MapView
                    center={center}
                    zoom={14}
                    issues={issues || []}
                    height="420px"
                    showRadius={true}
                  />
                )}

                {/* Legend */}
                <div className="d-flex gap-4 flex-wrap mt-3" style={{ fontSize: '.8rem', color: '#64748b' }}>
                  {Object.entries(severityColorHex).map(([sev, color]) => (
                    <span key={sev} className="d-flex align-items-center gap-1">
                      <span
                        style={{
                          width: 10, height: 10, borderRadius: '50%',
                          background: color, display: 'inline-block',
                        }}
                      />
                      <strong className="text-capitalize">{sev}</strong>&nbsp;severity
                      <Badge bg="light" text="dark" pill className="ms-1">{counts[sev]}</Badge>
                    </span>
                  ))}
                  <span className="d-flex align-items-center gap-1 ms-auto">
                    <span style={{
                      width: 14, height: 14, borderRadius: '50%',
                      background: '#1a56db', border: '2px solid #fff',
                      boxShadow: '0 0 0 4px rgba(26,86,219,.25)',
                      display: 'inline-block',
                    }} />
                    Your location
                  </span>
                </div>
              </Card.Body>
            </Card>
          </Col>

          {/* ---- Issue list column ---- */}
          <Col xs={12} lg={4}>
            <Card className="feature-card border-0 h-100">
              <Card.Body className="p-3">
                <div className="fw-bold mb-3 d-flex align-items-center justify-content-between"
                  style={{ fontSize: '.95rem' }}>
                  Nearby Issues
                  <Badge bg="primary" pill>{(issues || []).length}</Badge>
                </div>

                {loading ? (
                  <div className="text-center py-4">
                    <Spinner animation="border" size="sm" />
                  </div>
                ) : (issues || []).length === 0 ? (
                  <p className="text-muted text-center py-4 mb-0" style={{ fontSize: '.83rem' }}>
                    No issues found nearby.
                  </p>
                ) : (
                  <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                    {(issues || []).map(issue => (
                      <div
                        key={issue.id}
                        className="report-item"
                        id={`nearby-issue-${issue.id}`}
                      >
                        <div
                          className="report-icon flex-shrink-0"
                          style={{ background: '#f1f5f9', color: '#64748b' }}
                        >
                          <i className={`bi ${categoryIconMap[issue.category] ?? 'bi-three-dots'}`} />
                        </div>
                        <div className="flex-grow-1 min-w-0">
                          <div className="fw-semibold text-truncate" style={{ fontSize: '.84rem' }}>
                            {issue.title}
                          </div>
                          <div className="text-muted" style={{ fontSize: '.72rem' }}>
                            {issue.category}
                          </div>
                        </div>
                        <span
                          className="badge rounded-pill"
                          style={{
                            background: severityColorHex[issue.severity] ?? '#94a3b8',
                            fontSize: '.67rem', padding: '.3em .65em',
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
      </Container>
    </>
  );
};

export default NearbyIssuesMap;
