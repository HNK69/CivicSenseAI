import { useState, useRef, useCallback } from 'react';
import { Form, Button, Spinner } from 'react-bootstrap';
import useGeolocation from '../hooks/useGeolocation.js';
import { isAllowedMedia, isFileSizeOk } from '../utils/validators.js';
import MapView from './MapView.jsx';
import { DEFAULT_COORDS } from '../utils/constants.js';

/**
 * IssueUploadForm.jsx — Complete issue-reporting form component.
 *
 * Props:
 *  onSubmit  {Function}  Called with FormData payload
 *  loading   {boolean}   Shows spinner on submit button when true
 */
const IssueUploadForm = ({ onSubmit, loading = false }) => {
  const [files, setFiles]         = useState([]);
  const [dragOver, setDragOver]   = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs]     = useState(0);
  const [description, setDesc]    = useState('');
  const category = 'Other'; // AI service classifies automatically — no manual selection needed
  const [errors, setErrors]       = useState({});
  const fileInputRef              = useRef(null);
  const recIntervalRef            = useRef(null);

  const { coords, loading: gpsLoading, error: gpsError, refetch: refetchGPS } = useGeolocation();

  /* ---- File handling ---- */
  const addFiles = useCallback((incoming) => {
    const valid = Array.from(incoming).filter(f => isAllowedMedia(f) && isFileSizeOk(f, 20));
    setFiles(prev => [...prev, ...valid].slice(0, 5));   // max 5 files
  }, []);

  const removeFile = (idx) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const [transcribing, setTranscribing] = useState(false);
  const [audioError, setAudioError]     = useState(null);
  const [voiceAdded, setVoiceAdded]     = useState(false);
  const mediaRecorderRef                 = useRef(null);
  const audioChunksRef                   = useRef([]);


  /* ---- Voice recording & API transcription ---- */
  const startRecording = async () => {
    setAudioError(null);
    setVoiceAdded(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        setTranscribing(true);
        setAudioError(null);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice-recording.webm');

          const res = await fetch('/api/issues/transcribe', {
            method: 'POST',
            body: formData,
          });
          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData?.message || `Server error ${res.status}`);
          }
          const data = await res.json();

          // Backend wraps in { success, data: { text } }
          const transcribedText = data?.data?.text || data?.text || '';

          if (transcribedText.trim()) {
            // Append to existing description with a space separator
            setDesc(prev =>
              prev.trim() ? `${prev.trim()} ${transcribedText.trim()}` : transcribedText.trim()
            );
            setVoiceAdded(true);
          } else {
            setAudioError('Could not transcribe audio. Please speak clearly and try again.');
          }
        } catch (err) {
          console.warn('Transcription API error:', err);
          setAudioError('Transcription failed. Please check your connection and try again.');
          setVoiceAdded(false);
        } finally {
          setTranscribing(false);
        }
      };


      mediaRecorder.start();
      setRecording(true);
      setRecSecs(0);
      recIntervalRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
    } catch (err) {
      console.error('Microphone error:', err);
      setAudioError('Microphone access denied or unavailable.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      clearInterval(recIntervalRef.current);
      setRecording(false);
    }
  };

  const toggleRecording = () => {
    if (!recording) {
      startRecording();
    } else {
      stopRecording();
    }
  };

  const formatTime = (s) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  /* ---- Submit ---- */
  const handleSubmit = (e) => {
    e.preventDefault();
    const errs = {};
    if (!description.trim() || description.trim().length < 20)
      errs.description = 'Description must be at least 20 characters.';
    if (!coords && !gpsError)
      errs.location = 'Waiting for GPS…';

    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const formData = new FormData();
    // Auto-generate a title from the first line of description
    const autoTitle = `Civic Issue: ${description.trim().slice(0, 60)}${description.trim().length > 60 ? '…' : ''}`;
    formData.append('title',       autoTitle);
    formData.append('description', description);
    formData.append('category',    category);
    formData.append('latitude',    coords?.latitude  || '');
    formData.append('longitude',   coords?.longitude || '');
    files.forEach(f => {
      // Backend field: images for image types, videos for video types
      if (f.type.startsWith('video/')) {
        formData.append('videos', f);
      } else {
        formData.append('images', f);
      }
    });

    onSubmit?.(formData);
  };

  return (
    <Form noValidate onSubmit={handleSubmit} id="issue-report-form">

      {/* Category is auto-classified by the AI service — no dropdown needed */}

      {/* ---- Upload Zone ---- */}
      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold" style={{ fontSize: '.875rem' }}>
          Upload Photos / Videos <span className="text-muted fw-normal">(optional, max 5)</span>
        </Form.Label>
        <div
          className={`upload-zone${dragOver ? ' drag-over' : ''}`}
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDragOver={e => e.preventDefault()}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          id="media-upload-zone"
        >
          <i className="bi bi-cloud-arrow-up-fill d-block" />
          <p className="mb-1 fw-semibold" style={{ color: '#1a56db' }}>
            Drag &amp; drop or click to upload
          </p>
          <p style={{ fontSize: '.78rem', color: '#94a3b8', marginTop: 0 }}>
            JPEG, PNG, WebP, MP4, WebM · Max 20 MB per file
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            id="media-file-input"
            onChange={e => addFiles(e.target.files)}
          />
        </div>

        {/* File previews */}
        {files.length > 0 && (
          <div className="mt-2 d-flex flex-column gap-1" id="upload-preview">
            {files.map((f, i) => (
              <div
                key={i}
                className="d-flex align-items-center gap-2 p-2 bg-white rounded border"
                style={{ fontSize: '.82rem' }}
              >
                <i className={`bi ${f.type.startsWith('video') ? 'bi-camera-video-fill' : 'bi-image-fill'} text-primary`} />
                <span className="text-truncate flex-grow-1" style={{ maxWidth: 200 }}>{f.name}</span>
                <span className="text-muted">{(f.size / 1024).toFixed(1)} KB</span>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-danger"
                  onClick={e => { e.stopPropagation(); removeFile(i); }}
                >
                  <i className="bi bi-x-lg" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Form.Group>

      {/* ---- Voice Record ---- */}
      <Form.Group className="mb-3">
        <Form.Label className="fw-semibold d-block" style={{ fontSize: '.875rem' }}>
          Voice Description <span className="text-muted fw-normal">(optional)</span>
        </Form.Label>
        <div className="d-flex align-items-center gap-3">
          <button
            type="button"
            className={`btn-record ${recording ? 'recording' : ''}`}
            onClick={toggleRecording}
            disabled={transcribing}
            id="voice-record-btn"
          >
            <i className={`bi ${transcribing ? 'bi-hourglass-split' : recording ? 'bi-stop-circle-fill' : 'bi-mic-fill'}`} />
            <span className="rec-label">
              {transcribing ? 'Transcribing…' : recording ? 'Stop Recording' : 'Voice Record'}
            </span>
          </button>
          {(recording || recSecs > 0 || transcribing) && (
            <span
              className={recording ? 'text-danger fw-semibold small' : 'text-success fw-semibold small'}
              id="rec-timer"
            >
              {transcribing ? '⏳ Converting speech to text...' : recording ? `🔴 ${formatTime(recSecs)}` : (voiceAdded && !audioError) ? `✓ Voice added to description` : ''}
            </span>
          )}
        </div>
        {audioError && (
          <div className="text-danger small mt-1">{audioError}</div>
        )}
      </Form.Group>

      {/* ---- Text Description ---- */}
      <Form.Group className="mb-3" controlId="issueDescription">
        <Form.Label className="fw-semibold" style={{ fontSize: '.875rem' }}>
          Description <span className="text-danger">*</span>
        </Form.Label>
        <Form.Control
          as="textarea"
          rows={4}
          placeholder="Describe the issue in detail (min 20 characters)…"
          value={description}
          onChange={e => setDesc(e.target.value)}
          isInvalid={!!errors.description}
          style={{ borderRadius: 8, fontSize: '.875rem', resize: 'vertical' }}
          id="issue-description-textarea"
        />
        <Form.Control.Feedback type="invalid">{errors.description}</Form.Control.Feedback>
        <Form.Text className="text-muted">{description.length} characters</Form.Text>
      </Form.Group>

      {/* ---- GPS Location ---- */}
      <Form.Group className="mb-4">
        <Form.Label className="fw-semibold" style={{ fontSize: '.875rem' }}>
          Location (Auto GPS)
        </Form.Label>
        <div className="gps-field" id="gps-location-field">
          {gpsLoading ? (
            <>
              <Spinner animation="border" size="sm" variant="primary" />
              <span>Detecting location…</span>
            </>
          ) : gpsError ? (
            <>
              <i className="bi bi-exclamation-triangle-fill text-warning" />
              <span className="text-muted">{gpsError}</span>
              <button type="button" className="btn btn-link btn-sm p-0 ms-auto" onClick={refetchGPS}>
                Retry
              </button>
            </>
          ) : coords ? (
            <>
              <i className="bi bi-geo-alt-fill" style={{ color: '#ef4444' }} />
              <span>{coords.formattedString}</span>
              <button type="button" className="btn btn-link btn-sm p-0 ms-auto" onClick={refetchGPS}>
                <i className="bi bi-arrow-clockwise" />
              </button>
            </>
          ) : (
            <span className="text-muted">Location not available</span>
          )}
        </div>
        {errors.location && (
          <div className="text-danger mt-1" style={{ fontSize: '.8rem' }}>{errors.location}</div>
        )}

        {/* Live Leaflet map preview of Ballari / GPS location */}
        <div className="mt-2" id="mini-map-preview">
          <MapView
            center={coords ? [coords.latitude, coords.longitude] : DEFAULT_COORDS}
            zoom={14}
            height="180px"
            showRadius={true}
            issues={[]}
          />
        </div>
      </Form.Group>

      {/* ---- Submit ---- */}
      <Button
        type="submit"
        variant="primary"
        className="w-100 fw-bold py-2 rounded-pill"
        style={{ background: 'var(--civic-blue)', borderColor: 'var(--civic-blue)', fontSize: '.9rem' }}
        disabled={loading}
        id="submit-report-btn"
      >
        {loading ? (
          <><Spinner animation="border" size="sm" className="me-2" /> Submitting…</>
        ) : (
          <><i className="bi bi-send-fill me-2" /> Submit Report</>
        )}
      </Button>
    </Form>
  );
};

export default IssueUploadForm;

