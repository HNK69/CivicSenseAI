import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

// Fix default Leaflet marker icons in Vite/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

/** Severity → marker colour mapping */
const severityColorHex = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

const createCustomIcon = (severity = 'medium') =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:14px; height:14px; border-radius:50%;
      background:${severityColorHex[severity] ?? '#94a3b8'};
      border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
    "></div>`,
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });

/**
 * MapView.jsx — Reusable Leaflet map wrapper.
 *
 * Props:
 *  center     {[lat, lng]}  Map center coordinates
 *  zoom       {number}      Initial zoom level
 *  issues     {Array}       Issue objects with { id, title, lat, lng, severity }
 *  height     {string}      CSS height e.g. "360px"
 *  showRadius {boolean}     Draw 2 km radius circle around centre
 */
const MapView = ({
  center       = [12.9716, 77.5946],
  zoom         = 14,
  issues       = [],
  height       = '360px',
  showRadius   = true,
}) => (
  <MapContainer
    center={center}
    zoom={zoom}
    style={{ height, width: '100%', borderRadius: 12 }}
    id="leaflet-map"
  >
    <TileLayer
      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    />

    {/* User's location radius */}
    {showRadius && (
      <Circle
        center={center}
        radius={2000}
        pathOptions={{ color: '#1a56db', fillColor: '#dbeafe', fillOpacity: 0.15, weight: 1 }}
      />
    )}

    {/* Issue markers */}
    {issues.map(issue => (
      <Marker
        key={issue.id}
        position={[issue.lat, issue.lng]}
        icon={createCustomIcon(issue.severity)}
      >
        <Popup>
          <div style={{ minWidth: 160 }}>
            <div className="fw-bold mb-1" style={{ fontSize: '.85rem' }}>{issue.title}</div>
            <div style={{ fontSize: '.75rem', color: '#64748b' }}>
              <i className="bi bi-geo-alt-fill text-danger me-1" />
              {issue.category ?? '—'}
            </div>
            <span
              className={`badge bg-${issue.severity === 'high' ? 'danger' : issue.severity === 'medium' ? 'warning' : 'success'} mt-1`}
              style={{ fontSize: '.68rem' }}
            >
              {issue.severity?.toUpperCase()} severity
            </span>
          </div>
        </Popup>
      </Marker>
    ))}
  </MapContainer>
);

export default MapView;
