import { useState } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Badge, Modal, Form, Alert } from 'react-bootstrap';
import useFetch from '../hooks/useFetch.js';
import { getPendingVerifications, confirmRepair, disputeRepair } from '../services/verifyService.js';
import { formatDate } from '../utils/formatDate.js';
import BackButton from '../components/BackButton.jsx';


/**
 * VerifyRepair.jsx — List of completed repairs awaiting citizen verification.
 * Confirm (btn-success) / Still an Issue (btn-danger) actions per item.
 */
const VerifyRepair = () => {
  const { data: items, loading, error, refetch } = useFetch(getPendingVerifications, []);
  const [resolved, setResolved]   = useState({});   // { issueId: 'confirmed' | 'disputed' }
  const [actionLoading, setActionLoading] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeTarget, setDisputeTarget]       = useState(null);
  const [disputeReason, setDisputeReason]       = useState('');

  const handleConfirm = async (id) => {
    setActionLoading(id + '-confirm');
    try {
      await confirmRepair(id);
      setResolved(prev => ({ ...prev, [id]: 'confirmed' }));
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const openDispute = (item) => {
    setDisputeTarget(item);
    setDisputeReason('');
    setShowDisputeModal(true);
  };

  const handleDispute = async () => {
    if (!disputeTarget) return;
    setActionLoading(disputeTarget.id + '-dispute');
    try {
      await disputeRepair(disputeTarget.id, disputeReason);
      setResolved(prev => ({ ...prev, [disputeTarget.id]: 'disputed' }));
      setShowDisputeModal(false);
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(null);
    }
  };

  const pending = (items || []).filter(i => !resolved[i.id]);
  const done    = (items || []).filter(i =>  resolved[i.id]);

  return (
    <>
      {/* Sticky Hero Header */}
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <h1 className="mb-1">
            <i className="bi bi-patch-check-fill me-2" />Verify Repairs
          </h1>
          <p className="mb-0">Officials have marked these issues as completed. Please confirm or re-open.</p>
        </Container>
      </div>

      <Container className="py-5">
        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" />
            <p className="text-muted mt-2 mb-0">Loading verifications…</p>
          </div>
        ) : error ? (
          <Alert variant="danger">
            {error} — <button className="btn btn-link p-0" onClick={refetch}>Retry</button>
          </Alert>
        ) : (
          <>
            {/* ---- Pending verifications ---- */}
            {pending.length === 0 && done.length === 0 ? (
              <Card className="feature-card text-center py-5">
                <Card.Body>
                  <i className="bi bi-check-circle-fill text-success fs-1 d-block mb-3" />
                  <h3 className="fw-bold" style={{ fontSize: '1.1rem' }}>All caught up!</h3>
                  <p className="text-muted mb-0">No repairs waiting for your verification.</p>
                </Card.Body>
              </Card>
            ) : (
              <>
                {pending.length > 0 && (
                  <>
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <h2 className="section-heading mb-0" style={{ fontSize: '1.1rem' }}>
                        Awaiting Your Confirmation
                      </h2>
                      <Badge bg="success" pill>{pending.length}</Badge>
                    </div>
                    <Row className="g-4 mb-5">
                      {pending.map(item => (
                        <Col key={item.id} xs={12} md={6}>
                          <VerifyCard
                            item={item}
                            onConfirm={() => handleConfirm(item.id)}
                            onDispute={() => openDispute(item)}
                            confirmLoading={actionLoading === item.id + '-confirm'}
                            disputeLoading={actionLoading === item.id + '-dispute'}
                          />
                        </Col>
                      ))}
                    </Row>
                  </>
                )}

                {/* ---- Already resolved ---- */}
                {done.length > 0 && (
                  <>
                    <h2 className="section-heading mb-3" style={{ fontSize: '1rem', color: '#64748b' }}>
                      Recently Acted On
                    </h2>
                    <Row className="g-3">
                      {done.map(item => (
                        <Col key={item.id} xs={12} md={6}>
                          <Card className="border-0 rounded-3" style={{ background: '#f8fafc' }}>
                            <Card.Body className="p-3 d-flex align-items-center gap-3">
                              <i className={`bi fs-4 ${resolved[item.id] === 'confirmed' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-circle-fill text-danger'}`} />
                              <div>
                                <div className="fw-semibold" style={{ fontSize: '.875rem' }}>{item.title}</div>
                                <div className="text-muted" style={{ fontSize: '.75rem' }}>
                                  {resolved[item.id] === 'confirmed'
                                    ? 'You confirmed this repair as fixed.'
                                    : 'You re-opened this issue. Officials notified.'}
                                </div>
                              </div>
                            </Card.Body>
                          </Card>
                        </Col>
                      ))}
                    </Row>
                  </>
                )}
              </>
            )}
          </>
        )}
      </Container>

      {/* ---- Dispute Modal ---- */}
      <Modal show={showDisputeModal} onHide={() => setShowDisputeModal(false)} centered>
        <Modal.Header closeButton className="civic-modal-header">
          <Modal.Title style={{ fontSize: '1rem', fontWeight: 700 }}>
            <i className="bi bi-exclamation-triangle-fill me-2" />
            Report Still an Issue
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <p style={{ fontSize: '.875rem', color: '#475569' }}>
            Please describe why the repair is incomplete. This will re-open the issue and notify officials.
          </p>
          <Form.Group>
            <Form.Label className="fw-semibold" style={{ fontSize: '.875rem' }}>Reason</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="e.g. Pothole is still there, water still leaking…"
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              style={{ borderRadius: 8, fontSize: '.875rem' }}
              id="dispute-reason-textarea"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0">
          <Button variant="outline-secondary" onClick={() => setShowDisputeModal(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDispute}
            disabled={!disputeReason.trim() || actionLoading}
            id="submit-dispute-btn"
          >
            {actionLoading ? <Spinner animation="border" size="sm" /> : 'Submit Dispute'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

/* ---- Inner VerifyCard ---- */
const VerifyCard = ({ item, onConfirm, onDispute, confirmLoading, disputeLoading }) => (
  <Card className="feature-card verify-card border-0 h-100">
    <Card.Body className="p-4 d-flex flex-column gap-3">
      {/* Header */}
      <div className="d-flex align-items-start gap-2">
        <div className="card-icon-wrap ci-green flex-shrink-0">
          <i className="bi bi-wrench-adjustable-circle-fill" />
        </div>
        <div>
          <div className="fw-bold" style={{ fontSize: '.95rem' }}>{item.title}</div>
          <div className="text-muted" style={{ fontSize: '.78rem' }}>
            <i className="bi bi-geo-alt-fill text-danger me-1" />{item.location}
          </div>
          <div className="text-muted" style={{ fontSize: '.75rem' }}>
            Completed on {formatDate(item.completedAt)}
          </div>
        </div>
      </div>

      {/* Before / After photos */}
      <div className="before-after-grid">
        <div className="img-placeholder">
          <i className="bi bi-image-fill" />
          <span>Before</span>
        </div>
        <div className="img-placeholder">
          <i className="bi bi-image-fill" />
          <span>After</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="d-flex gap-2 mt-auto">
        <Button
          variant="success"
          className="flex-grow-1 fw-semibold rounded-pill"
          onClick={onConfirm}
          disabled={confirmLoading || disputeLoading}
          id={`confirm-btn-${item.id}`}
          style={{ fontSize: '.85rem' }}
        >
          {confirmLoading
            ? <Spinner animation="border" size="sm" />
            : <><i className="bi bi-check-circle-fill me-1" /> Confirm Fixed</>}
        </Button>
        <Button
          variant="danger"
          className="flex-grow-1 fw-semibold rounded-pill"
          onClick={onDispute}
          disabled={confirmLoading || disputeLoading}
          id={`dispute-btn-${item.id}`}
          style={{ fontSize: '.85rem' }}
        >
          {disputeLoading
            ? <Spinner animation="border" size="sm" />
            : <><i className="bi bi-exclamation-circle-fill me-1" /> Still an Issue</>}
        </Button>
      </div>
    </Card.Body>
  </Card>
);

export default VerifyRepair;
