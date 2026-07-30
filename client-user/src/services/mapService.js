import api from '../utils/axiosInstance.js';
import { DEFAULT_COORDS } from '../utils/constants.js';

/* ---- MOCK FALLBACK DATA FOR BALLARI ---- */
const MOCK_NEARBY_BALLARI = [
  { id: 'ISS-2401', title: 'Pothole on Station Road',       lat: 15.1394, lng: 76.9214, severity: 'high',   category: 'Roads',       address: 'Station Road, Ballari' },
  { id: 'ISS-2392', title: 'Water pipe leakage',          lat: 15.1405, lng: 76.9200, severity: 'medium', category: 'Water',       address: '5th Cross, Gandhi Nagar, Ballari' },
  { id: 'ISS-2380', title: 'Overflowing garbage bin',     lat: 15.1350, lng: 76.9250, severity: 'low',    category: 'Sanitation',  address: 'Infantry Road, Ballari' },
  { id: 'ISS-2375', title: 'Broken street light near Fort', lat: 15.1420, lng: 76.9180, severity: 'medium', category: 'Electricity',address: 'Fort Area, Ballari' },
  { id: 'ISS-2360', title: 'Damaged footpath near Park',   lat: 15.1375, lng: 76.9230, severity: 'low',    category: 'Parks',        address: 'Car Street, Ballari' },
  { id: 'ISS-2350', title: 'Open drain near Bus Stand',    lat: 15.1440, lng: 76.9265, severity: 'high',   category: 'Sanitation',  address: 'KSRTC Bus Stand Road, Ballari' },
];

/**
 * mapService.js — Nearby issues map API calls.
 */

/**
 * Get issues near a GPS coordinate within a radius (default 2km).
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm
 */
export const getNearbyIssues = async (lat = DEFAULT_COORDS[0], lng = DEFAULT_COORDS[1], radiusKm = 2) => {
  try {
    const res = await api.get('/issues/nearby', {
      params: { lat, lng, radius: radiusKm },
    });

    const issues = res?.data?.issues || res?.issues || [];

    if (!Array.isArray(issues) || issues.length === 0) {
      return MOCK_NEARBY_BALLARI;
    }

    return issues.map(item => {
      const coords = item.location?.coordinates || [lng, lat];
      const severity = (item.priority || item.aiMeta?.priority || 'medium').toLowerCase();

      return {
        id: item._id || item.id,
        _id: item._id || item.id,
        title: item.title,
        category: item.category,
        status: item.status,
        severity: ['high', 'medium', 'low'].includes(severity) ? severity : 'medium',
        lat: coords[1] !== undefined ? coords[1] : lat,
        lng: coords[0] !== undefined ? coords[0] : lng,
        address: item.address || 'Ballari, Karnataka',
      };
    });
  } catch (err) {
    console.warn('[mapService] Failed to fetch real nearby issues, using Ballari mock fallback:', err.message);
    return MOCK_NEARBY_BALLARI;
  }
};

/** Get map cluster data for a bounding box */
export const getIssueClusters = async (bounds) => {
  return MOCK_NEARBY_BALLARI;
};
