import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Alert } from 'react-bootstrap';
import { motion } from 'framer-motion';
import IssueUploadForm from '../components/IssueUploadForm.jsx';
import { reportIssue } from '../services/issueService.js';
import BackButton from '../components/BackButton.jsx';

const ReportIssue = () => {
  const navigate              = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');
  const [issueId, setIssueId] = useState('');

  const handleSubmit = async (formData) => {
    setLoading(true);
    setError('');
    try {
      const res = await reportIssue(formData);
      setIssueId(res.issueId);
      setSuccess(true);
      setTimeout(() => navigate('/status'), 2200);
    } catch (err) {
      setError(err?.response?.data?.message || 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <h1><i className="bi bi-camera-fill" />Report a Civic Issue</h1>
          <p>Help improve your neighbourhood by reporting what you see.</p>
        </Container>
      </div>

      {/* Floating feedback toasts */}
      {success && (
        <div style={{ position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, minWidth: 340, maxWidth: '90vw' }}>
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
            <Alert
              variant="success"
              dismissible
              onClose={() => navigate('/status')}
              className="mb-0 border-0 shadow-lg"
              style={{ background: 'var(--green)', color: '#fff', borderRadius: 12 }}
            >
              <div className="d-flex align-items-center gap-2">
                <i className="bi bi-check-circle-fill" style={{ fontSize: '1.2rem' }} />
                <div>
                  <strong>Submitted successfully!</strong>
                  <div style={{ fontSize: '.84rem', opacity: .9 }}>Report ID: <strong>{issueId}</strong>. Redirecting…</div>
                </div>
              </div>
            </Alert>
          </motion.div>
        </div>
      )}

      {error && (
        <div style={{ position: 'fixed', top: 72, left: '50%', transform: 'translateX(-50%)', zIndex: 9999, minWidth: 320, maxWidth: '90vw' }}>
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
            <Alert variant="danger" dismissible onClose={() => setError('')} className="shadow-lg border-0" style={{ borderRadius: 12 }}>
              <i className="bi bi-exclamation-circle-fill me-2" />{error}
            </Alert>
          </motion.div>
        </div>
      )}

      <Container className="py-4" style={{ maxWidth: 740 }}>
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }}>
          <Row className="g-4">
            <Col xs={12}>
              <Card className="feature-card">
                <Card.Body className="p-4">
                  <div className="d-flex align-items-center gap-3 mb-4">
                    <div className="card-icon-wrap ci-blue">
                      <i className="bi bi-exclamation-triangle-fill" />
                    </div>
                    <div>
                      <h2 style={{ fontSize: '1rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, marginBottom: 2 }}>Issue Details</h2>
                      <p style={{ fontSize: '.82rem', color: 'var(--text-secondary)', margin: 0 }}>
                        Fill in as much detail as possible for faster resolution.
                      </p>
                    </div>
                  </div>
                  <IssueUploadForm onSubmit={handleSubmit} loading={loading} />
                </Card.Body>
              </Card>
            </Col>

            {/* Tips */}
            <Col xs={12}>
              <div
                style={{
                  background: 'var(--civic-blue-light)',
                  border: '1px solid var(--civic-blue-muted)',
                  borderRadius: 12,
                  padding: '14px 18px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '.84rem', color: 'var(--civic-blue)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="bi bi-lightbulb-fill" /> Tips for a good report
                </div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: '.81rem', color: 'var(--text-secondary)', lineHeight: 1.85 }}>
                  <li>Add at least one photo for faster processing</li>
                  <li>Describe the exact location if GPS is unclear</li>
                  <li>Be specific — "pothole 2m wide near bus stop" beats "road damage"</li>
                  <li>Reports with media are resolved 40% faster</li>
                </ul>
              </div>
            </Col>
          </Row>
        </motion.div>
      </Container>
    </>
  );
};

export default ReportIssue;
