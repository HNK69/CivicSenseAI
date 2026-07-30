import { useState } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Badge, Modal, Form, Alert } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import useFetch from '../hooks/useFetch.js';
import { getPendingVerifications, confirmRepair, disputeRepair } from '../services/verifyService.js';
import { formatDate } from '../utils/formatDate.js';
import BackButton from '../components/BackButton.jsx';

const VerifyRepair = () => {
  const { data: items, loading, error, refetch } = useFetch(getPendingVerifications, []);
  const [resolved, setResolved]   = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeTarget, setDisputeTarget]       = useState(null);
  const [disputeReason, setDisputeReason]       = useState('');

  const handleConfirm = async (id) => {
    setActionLoading(id + '-confirm');
    try {
      await confirmRepair(id);
      setResolved(prev => ({ ...prev, [id]: 'confirmed' }));
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
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
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  const pending = (items || []).filter(i => !resolved[i.id]);
  const done    = (items || []).filter(i =>  resolved[i.id]);

  return (
    <>
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <h1><i className="bi bi-patch-check-fill" />Verify Repairs</h1>
          <p>Officials have marked these issues completed. Please confirm or re-open.</p>
        </Container>
      </div>

      <Container className="py-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" variant="primary" />
            </div>
          ) : error ? (
            <Alert variant="danger" style={{ borderRadius: 12 }}>
              {error} — <button className="btn btn-link p-0" onClick={refetch}>Retry</button>
            </Alert>
          ) : (
            <>
              {pending.length === 0 && done.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Card className="feature-card text-center py-5">
                    <Card.Body>
                      <i className="bi bi-check-circle-fill d-block mb-3" style={{ fontSize: '3rem', color: 'var(--green)' }} />
                      <h3 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: '1.15rem' }}>All caught up!</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', margin: 0 }}>No repairs waiting for your verification.</p>
                    </Card.Body>
                  </Card>
                </motion.div>
              ) : (
                <>
                  {pending.length > 0 && (
                    <>
                      <div className="d-flex align-items-center gap-2 mb-3">
                        <h2 className="section-heading mb-0" style={{ fontSize: '1.05rem' }}>Awaiting Your Confirmation</h2>
                        <Badge pill style={{ background: 'var(--green)', fontSize: '.7rem' }}>{pending.length}</Badge>
                      </div>
                      <Row className="g-4 mb-5">
                        <AnimatePresence>
                          {pending.map((item, idx) => (
                            <Col key={item.id} xs={12} md={6}>
                              <motion.div
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                transition={{ delay: idx * 0.06, duration: 0.25 }}
                              >
                                <VerifyCard
                                  item={item}
                                  onConfirm={() => handleConfirm(item.id)}
                                  onDispute={() => openDispute(item)}
                                  confirmLoading={actionLoading === item.id + '-confirm'}
                                  disputeLoading={actionLoading === item.id + '-dispute'}
                                />
                              </motion.div>
                            </Col>
                          ))}
                        </AnimatePresence>
                      </Row>
                    </>
                  )}

                  {done.length > 0 && (
                    <>
                      <h2 style={{ fontSize: '.9rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>Recently Acted On</h2>
                      <Row className="g-3">
                        {done.map(item => (
                          <Col key={item.id} xs={12} md={6}>
                            <div
                              style={{
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-base)',
                                borderRadius: 12,
                                padding: '14px 16px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12,
                              }}
                            >
                              <i
                                className={`bi ${resolved[item.id] === 'confirmed' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`}
                                style={{ fontSize: '1.5rem', color: resolved[item.id] === 'confirmed' ? 'var(--green)' : 'var(--red)' }}
                              />
                              <div>
                                <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{item.title}</div>
                                <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                  {resolved[item.id] === 'confirmed'
                                    ? 'You confirmed this repair as fixed.'
                                    : 'You re-opened this issue. Officials notified.'}
                                </div>
                              </div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </>
                  )}
                </>
              )}
            </>
          )}
        </motion.div>
      </Container>

      {/* Dispute Modal */}
      <Modal show={showDisputeModal} onHide={() => setShowDisputeModal(false)} centered>
        <Modal.Header closeButton className="civic-modal-header">
          <Modal.Title>
            <i className="bi bi-exclamation-triangle-fill me-2" style={{ color: 'var(--red)' }} />
            Report Still an Issue
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Describe why the repair is incomplete. This will re-open the issue and notify officials.
          </p>
          <Form.Group>
            <Form.Label style={{ fontWeight: 600, fontSize: '.875rem' }}>Reason</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="e.g. Pothole is still there, water still leaking…"
              value={disputeReason}
              onChange={e => setDisputeReason(e.target.value)}
              id="dispute-reason-textarea"
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer style={{ borderTop: '1px solid var(--border-base)', padding: '12px 20px' }}>
          <Button variant="outline-secondary" onClick={() => setShowDisputeModal(false)}>Cancel</Button>
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

const VerifyCard = ({ item, onConfirm, onDispute, confirmLoading, disputeLoading }) => (
  <Card className="feature-card verify-card h-100">
    <Card.Body className="p-4 d-flex flex-column gap-3">
      <div className="d-flex align-items-start gap-3">
        <div className="card-icon-wrap ci-green flex-shrink-0">
          <i className="bi bi-wrench-adjustable-circle-fill" />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '.95rem' }}>{item.title}</div>
          <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
            <i className="bi bi-geo-alt-fill me-1" style={{ color: 'var(--red)' }} />{item.location}
          </div>
          <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
            Completed on {formatDate(item.completedAt)}
          </div>
        </div>
      </div>

      <div className="before-after-grid">
        <div className="img-placeholder"><i className="bi bi-image-fill" /><span>Before</span></div>
        <div className="img-placeholder"><i className="bi bi-image-fill" /><span>After</span></div>
      </div>

      <div className="d-flex gap-2 mt-auto">
        <motion.div whileTap={{ scale: 0.96 }} style={{ flex: 1 }}>
          <Button
            variant="success"
            className="w-100 fw-semibold"
            onClick={onConfirm}
            disabled={confirmLoading || disputeLoading}
            id={`confirm-btn-${item.id}`}
            style={{ fontSize: '.84rem' }}
          >
            {confirmLoading ? <Spinner animation="border" size="sm" /> : <><i className="bi bi-check-circle-fill me-1" />Confirm Fixed</>}
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.96 }} style={{ flex: 1 }}>
          <Button
            variant="outline-danger"
            className="w-100 fw-semibold"
            onClick={onDispute}
            disabled={confirmLoading || disputeLoading}
            id={`dispute-btn-${item.id}`}
            style={{ fontSize: '.84rem' }}
          >
            {disputeLoading ? <Spinner animation="border" size="sm" /> : <><i className="bi bi-exclamation-circle-fill me-1" />Still an Issue</>}
          </Button>
        </motion.div>
      </div>
    </Card.Body>
  </Card>
);

export default VerifyRepair;
