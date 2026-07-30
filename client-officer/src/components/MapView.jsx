import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';

// Default Ballari, Karnataka coordinates
const BALLARI_COORDS = [15.1394, 76.9214];

// Fix default Leaflet marker icons in Vite/Webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const priorityColorMap = {
  CRITICAL: '#dc3545',
  HIGH:     '#ffc107',
  MEDIUM:   '#0dcaf0',
  LOW:      '#198754',
};

const createCustomIcon = (priority = 'MEDIUM') =>
  L.divIcon({
    className: '',
    html: `<div style="
      width:14px; height:14px; border-radius:50%;
      background:${priorityColorMap[priority] || '#6c757d'};
      border:2px solid #fff;
      box-shadow:0 2px 6px rgba(0,0,0,.3);
    "></div>`,
    iconAnchor: [7, 7],
    popupAnchor: [0, -10],
  });

/**
 * MapView — Officer Portal Leaflet Map component centered on Ballari
 */
const MapView = ({
  center = BALLARI_COORDS,
  zoom = 13,
  issues = [],
  height = '400px',
}) => {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%', borderRadius: '12px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* 2 km Ballari city center radius circle */}
      <Circle
        center={center}
        radius={2000}
        pathOptions={{ color: '#0d6efd', fillColor: '#0d6efd', fillOpacity: 0.1, weight: 1 }}
      />

      {/* Issue markers */}
      {issues.map((issue, idx) => {
        const lat = issue.location?.coordinates?.[1] || issue.lat || (BALLARI_COORDS[0] + (idx * 0.003 - 0.006));
        const lng = issue.location?.coordinates?.[0] || issue.lng || (BALLARI_COORDS[1] + (idx * 0.003 - 0.006));

        return (
          <Marker
            key={issue._id || issue.id || idx}
            position={[lat, lng]}
            icon={createCustomIcon(issue.priority)}
          >
            <Popup>
              <div style={{ minWidth: 170 }}>
                <div className="fw-bold mb-1" style={{ fontSize: '0.85rem' }}>{issue.title}</div>
                <div style={{ fontSize: '0.75rem', color: '#6c757d' }}>
                  <i className="bi bi-geo-alt-fill text-danger me-1"></i>
                  {issue.location?.address || issue.address || 'Ballari, Karnataka'}
                </div>
                <div className="mt-1 d-flex gap-1">
                  <span className="badge bg-light text-dark border" style={{ fontSize: '0.68rem' }}>
                    {issue.category}
                  </span>
                  <span className={`badge ${issue.priority === 'CRITICAL' ? 'bg-danger' : issue.priority === 'HIGH' ? 'bg-warning text-dark' : 'bg-info text-dark'}`} style={{ fontSize: '0.68rem' }}>
                    {issue.priority}
                  </span>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
};

export default MapView;
