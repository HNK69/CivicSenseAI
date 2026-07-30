import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Alert, Toast, ToastContainer } from 'react-bootstrap';
import IssueUploadForm from '../components/IssueUploadForm.jsx';
import { reportIssue } from '../services/issueService.js';
import BackButton from '../components/BackButton.jsx';

/**
 * ReportIssue.jsx — Full-page issue reporting form.
 * Wraps <IssueUploadForm> and handles submission + feedback.
 */
const ReportIssue = () => {
  const navigate           = useNavigate();
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [error,   setError]     = useState('');
  const [issueId, setIssueId]   = useState('');

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError('');
    try {
      const res = await reportIssue(formData);
      setIssueId(res.issueId);
      setSuccess(true);
      setTimeout(() => {
        navigate('/status');
      }, 2200);
    } catch (err) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Sticky Hero Header */}
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <h1 className="mb-1">
            <i className="bi bi-camera-fill me-2" />Report a Civic Issue
          </h1>
          <p className="mb-0">Help improve your neighbourhood by reporting what you see.</p>
        </Container>
      </div>

      <Container className="py-5" style={{ maxWidth: 720 }}>

        {/* Floating Success Toast Overlay at screen top */}
        {success && (
          <div
            style={{
              position: 'fixed',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              minWidth: '340px',
              maxWidth: '90vw',
              boxShadow: '0 8px 30px rgba(0,0,0,0.25)',
              borderRadius: '12px',
              overflow: 'hidden',
            }}
          >
            <Alert
              variant="success"
              dismissible
              onClose={() => navigate('/status')}
              className="mb-0 shadow-lg border-0"
              style={{ background: '#10b981', color: '#fff' }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill fs-5" />
                <div>
                  <strong>Issue Submitted Successfully!</strong>
                  <div style={{ fontSize: '.84rem', opacity: 0.95 }}>
                    Report ID: <strong>{issueId}</strong>. Redirecting to Track Status…
                  </div>
                </div>
              </div>
            </Alert>
          </div>
        )}

        {/* Floating Error Alert at screen top */}
        {error && (
          <div
            style={{
              position: 'fixed',
              top: '80px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              minWidth: '320px',
              maxWidth: '90vw',
            }}
          >
            <Alert variant="danger" dismissible onClose={() => setError('')} className="shadow-lg border-0">
              <i className="bi bi-exclamation-circle-fill me-2" />{error}
            </Alert>
          </div>
        )}

        <Row>
          {/* ---- Form card ---- */}
          <Col xs={12}>
            <Card className="feature-card border-0">
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-3 mb-4">
                  <div className="card-icon-wrap ci-blue">
                    <i className="bi bi-exclamation-triangle-fill" />
                  </div>
                  <div>
                    <h2 className="mb-0 fw-bold" style={{ fontSize: '1.1rem' }}>Issue Details</h2>
                    <p className="mb-0 text-muted" style={{ fontSize: '.83rem' }}>
                      Fill in as much detail as possible for faster resolution.
                    </p>
                  </div>
                </div>

                <IssueUploadForm onSubmit={handleSubmit} loading={loading} />
              </Card.Body>
            </Card>
          </Col>

          {/* ---- Tips card ---- */}
          <Col xs={12} className="mt-4">
            <Card className="border-0" style={{ background: '#eff6ff', borderRadius: 12 }}>
              <Card.Body className="p-3">
                <div className="fw-bold mb-2" style={{ fontSize: '.875rem', color: '#1a56db' }}>
                  <i className="bi bi-lightbulb-fill me-2" />Tips for a good report
                </div>
                <ul className="mb-0 ps-3" style={{ fontSize: '.82rem', color: '#475569', lineHeight: 1.8 }}>
                  <li>Add at least one photo for faster processing</li>
                  <li>Describe the exact location if GPS is unclear</li>
                  <li>Be specific — "pothole 2m wide near bus stop" beats "road damage"</li>
                  <li>Reports with media are resolved 40% faster</li>
                </ul>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </>
  );
};

export default ReportIssue;
