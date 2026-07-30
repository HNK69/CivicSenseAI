import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Alert, Toast, ToastContainer } from 'react-bootstrap';
import IssueUploadForm from '../components/IssueUploadForm.jsx';
import { reportIssue } from '../services/issueService.js';

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
    } catch (err) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Hero */}
      <div className="page-hero" style={{ paddingTop: 'calc(64px + 2rem)' }}>
        <Container>
          <h1 className="mb-1">
            <i className="bi bi-camera-fill me-2" />Report a Civic Issue
          </h1>
          <p className="mb-0">Help improve your neighbourhood by reporting what you see.</p>
        </Container>
      </div>

      <Container className="py-5" style={{ maxWidth: 720 }}>

        {/* Success toast */}
        <ToastContainer position="top-center" className="mt-3">
          <Toast show={success} onClose={() => navigate('/status')} delay={4000} autohide bg="success">
            <Toast.Header><strong className="me-auto text-success">✓ Issue Submitted!</strong></Toast.Header>
            <Toast.Body className="text-white">
              Your report <strong>{issueId}</strong> has been submitted. Redirecting to status…
            </Toast.Body>
          </Toast>
        </ToastContainer>

        {error && (
          <Alert variant="danger" dismissible onClose={() => setError('')}>
            <i className="bi bi-exclamation-circle-fill me-2" />{error}
          </Alert>
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
