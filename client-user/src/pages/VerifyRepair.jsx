import { useState } from 'react';
import { Container, Row, Col, Card, Button, Spinner, Badge, Modal, Form, Alert } from 'react-bootstrap';
import { motion, AnimatePresence } from 'framer-motion';
import useFetch from '../hooks/useFetch.js';
import { getPendingVerifications, confirmRepair, disputeRepair } from '../services/verifyService.js';
import { formatDate } from '../utils/formatDate.js';
import BackButton from '../components/BackButton.jsx';

const VerifyRepair = () => {
  const { data: items, loading, error, refetch } = useFetch(getPendingVerifications, []);
  const [resolved, setResolved]         = useState({});
  const [actionLoading, setActionLoading] = useState(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeTarget, setDisputeTarget]       = useState(null);
  const [disputeReason, setDisputeReason]       = useState('');

  const getItemId = (item) => item?._id || item?.id;

  const handleConfirm = async (item) => {
    const id = getItemId(item);
    if (!id) return;
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
    const targetId = getItemId(disputeTarget);
    setActionLoading(targetId + '-dispute');
    try {
      await disputeRepair(targetId, disputeReason);
      setResolved(prev => ({ ...prev, [targetId]: 'disputed' }));
      setShowDisputeModal(false);
    } catch (e) { console.error(e); }
    finally { setActionLoading(null); }
  };

  const pending = (items || []).filter(i => !resolved[getItemId(i)]);
  const done    = (items || []).filter(i =>  resolved[getItemId(i)]);

  return (
    <>
      <div className="page-hero">
        <Container>
          <BackButton fallback="/dashboard" />
          <h1><i className="bi bi-patch-check-fill" />Verify Repairs</h1>
          <p>Officials and AI have verified these completed repairs. Confirm resolution or reopen if incomplete.</p>
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
                      <p style={{ color: 'var(--text-muted)', fontSize: '.875rem', margin: 0 }}>No repairs waiting for your verification right now.</p>
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
                          {pending.map((item, idx) => {
                            const id = getItemId(item);
                            return (
                              <Col key={id || idx} xs={12} md={6}>
                                <motion.div
                                  initial={{ opacity: 0, y: 16 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  transition={{ delay: idx * 0.06, duration: 0.25 }}
                                >
                                  <VerifyCard
                                    item={item}
                                    onConfirm={() => handleConfirm(item)}
                                    onDispute={() => openDispute(item)}
                                    confirmLoading={actionLoading === id + '-confirm'}
                                    disputeLoading={actionLoading === id + '-dispute'}
                                  />
                                </motion.div>
                              </Col>
                            );
                          })}
                        </AnimatePresence>
                      </Row>
                    </>
                  )}

                  {done.length > 0 && (
                    <>
                      <h2 style={{ fontSize: '.9rem', color: 'var(--text-muted)', fontWeight: 600, marginBottom: 12 }}>Recently Acted On</h2>
                      <Row className="g-3">
                        {done.map(item => {
                          const id = getItemId(item);
                          return (
                            <Col key={id} xs={12} md={6}>
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
                                  className={`bi ${resolved[id] === 'confirmed' ? 'bi-check-circle-fill' : 'bi-exclamation-circle-fill'}`}
                                  style={{ fontSize: '1.5rem', color: resolved[id] === 'confirmed' ? 'var(--green)' : 'var(--red)' }}
                                />
                                <div>
                                  <div style={{ fontWeight: 600, fontSize: '.875rem' }}>{item.title}</div>
                                  <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                    {resolved[id] === 'confirmed'
                                      ? 'You confirmed this repair as fixed.'
                                      : 'You re-opened this issue. Municipal officers have been notified.'}
                                  </div>
                                </div>
                              </div>
                            </Col>
                          );
                        })}
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
            Reopen Complaint
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <p style={{ fontSize: '.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Describe why the repair is incomplete. This will reopen the issue and notify municipal officers immediately.
          </p>
          <Form.Group>
            <Form.Label style={{ fontWeight: 600, fontSize: '.875rem' }}>Reason for Reopening</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              placeholder="e.g. Pothole is still present, debris left behind, water leaking…"
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
            disabled={!disputeReason.trim() || !!actionLoading}
            id="submit-dispute-btn"
          >
            {actionLoading ? <Spinner animation="border" size="sm" /> : 'Reopen Complaint'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
};

const VerifyCard = ({ item, onConfirm, onDispute, confirmLoading, disputeLoading }) => {
  const id = item?._id || item?.id;

  // Safely extract image URL whether it's a string or an object {url: '...'}
  const extractUrl = (val) => {
    if (!val) return null;
    if (typeof val === 'string') return val;
    if (typeof val === 'object' && val.url) return val.url;
    return null;
  };

  const beforeImg =
    extractUrl(item?.images?.[0]) ||
    extractUrl(item?.media?.[0]) ||
    extractUrl(item?.beforeImage) ||
    'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=500&auto=format&fit=crop';

  const afterImg =
    extractUrl(item?.afterMedia?.[0]) ||
    extractUrl(item?.afterImage) ||
    extractUrl(item?.repair_verification?.afterImage) ||
    extractUrl(item?.workOrder?.afterImage) ||
    'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=500&auto=format&fit=crop';

  const ai = item?.repair_verification || item?.ai_repair_verification || {};
  const aiConfidence = ai?.confidence != null
    ? (ai.confidence * 100).toFixed(0)
    : null;
  const aiExplanation = ai?.explanation || 'Pending AI analysis — officer has approved this repair.';

  const locationText =
    item?.address ||
    (typeof item?.location === 'string' ? item.location : item?.location?.address) ||
    'Location not specified';



  return (
    <Card className="feature-card verify-card h-100 shadow-sm border">
      <Card.Body className="p-4 d-flex flex-column gap-3">
        <div className="d-flex align-items-start justify-content-between gap-2">
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>{item.title || 'Civic Infrastructure Repair'}</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 3 }}>
              <i className="bi bi-geo-alt-fill me-1 text-danger" />{locationText}
            </div>
            <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>
              Completed on {formatDate(item.updatedAt || item.createdAt)}
            </div>
          </div>
          <Badge bg="success" className="px-2 py-1">Officer Approved</Badge>
        </div>

        {/* Media Before/After grid */}
        <div className="row g-2 my-1">
          <div className="col-6">
            <div className="text-muted mb-1 fw-bold" style={{ fontSize: '.72rem', textTransform: 'uppercase' }}>Before Repair</div>
            <div className="ratio ratio-4x3 rounded overflow-hidden border bg-dark">
              <img src={beforeImg} alt="Before repair" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
            </div>
          </div>
          <div className="col-6">
            <div className="text-muted mb-1 fw-bold" style={{ fontSize: '.72rem', textTransform: 'uppercase' }}>After Repair</div>
            <div className="ratio ratio-4x3 rounded overflow-hidden border bg-dark">
              <img src={afterImg} alt="After repair" style={{ objectFit: 'cover', width: '100%', height: '100%' }} />
            </div>
          </div>
        </div>

        {/* AI Result summary box */}
        <div
          style={{
            background: 'rgba(16, 185, 129, 0.08)',
            border: '1px solid rgba(16, 185, 129, 0.25)',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: '.8rem',
            color: 'var(--text-primary)',
          }}
        >
          <div className="d-flex align-items-center justify-content-between mb-1">
            <span className="fw-bold text-success"><i className="bi bi-robot me-1" />AI Verification Result</span>
            {aiConfidence != null && (
              <Badge bg="success" style={{ fontSize: '.7rem' }}>{aiConfidence}% Confidence</Badge>
            )}
          </div>
          <p className="mb-0 text-muted" style={{ fontSize: '.78rem', lineHeight: 1.45 }}>{aiExplanation}</p>
        </div>

        {/* Actions */}
        <div className="d-flex gap-2 mt-auto pt-2">
          <motion.div whileTap={{ scale: 0.96 }} style={{ flex: 1 }}>
            <Button
              variant="success"
              className="w-100 fw-semibold"
              onClick={onConfirm}
              disabled={confirmLoading || disputeLoading}
              id={`confirm-btn-${id}`}
              style={{ fontSize: '.84rem' }}
            >
              {confirmLoading ? <Spinner animation="border" size="sm" /> : <><i className="bi bi-check-circle-fill me-1" />Confirm Repair</>}
            </Button>
          </motion.div>
          <motion.div whileTap={{ scale: 0.96 }} style={{ flex: 1 }}>
            <Button
              variant="outline-danger"
              className="w-100 fw-semibold"
              onClick={onDispute}
              disabled={confirmLoading || disputeLoading}
              id={`dispute-btn-${id}`}
              style={{ fontSize: '.84rem' }}
            >
              {disputeLoading ? <Spinner animation="border" size="sm" /> : <><i className="bi bi-exclamation-circle-fill me-1" />Reopen Complaint</>}
            </Button>
          </motion.div>
        </div>
      </Card.Body>
    </Card>
  );
};

export default VerifyRepair;
