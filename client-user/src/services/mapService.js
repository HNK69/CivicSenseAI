import api from '../utils/axiosInstance.js';

/* ---- MOCK DATA ---- */
const MOCK_NEARBY = [
  { id: 'ISS-2401', title: 'Pothole on MG Road',          lat: 12.9726, lng: 77.5950, severity: 'high',   category: 'roads'      },
  { id: 'ISS-2392', title: 'Water pipe leakage',           lat: 12.9705, lng: 77.5935, severity: 'medium', category: 'water'      },
  { id: 'ISS-2380', title: 'Overflowing garbage bin',      lat: 12.9700, lng: 77.5960, severity: 'low',    category: 'sanitation' },
  { id: 'ISS-2375', title: 'Broken street lamp',           lat: 12.9730, lng: 77.5930, severity: 'medium', category: 'electricity'},
  { id: 'ISS-2360', title: 'Encroachment on footpath',     lat: 12.9715, lng: 77.5945, severity: 'low',    category: 'other'      },
  { id: 'ISS-2350', title: 'Open manhole near school',     lat: 12.9740, lng: 77.5965, severity: 'high',   category: 'sanitation' },
];

/**
 * mapService.js — Nearby issues map API calls.
 * TODO: connect to real backend endpoints when ready.
 */

/**
 * Get issues near a GPS coordinate within a radius.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 */
export const getNearbyIssues = async (lat, lng, radiusKm = 2) => {
  // TODO: connect to backend endpoint — GET /api/issues/nearby?lat=&lng=&radius=
  // return api.get('/issues/nearby', { params: { lat, lng, radius: radiusKm } });
  return MOCK_NEARBY;
};

/** Get map cluster data for a bounding box */
export const getIssueClusters = async (bounds) => {
  // TODO: connect to backend endpoint — GET /api/issues/clusters?bounds=
  // return api.get('/issues/clusters', { params: bounds });
  return MOCK_NEARBY;
};
