import api from '../utils/axiosInstance.js';
import { DEFAULT_COORDS } from '../utils/constants.js';

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
  const res = await api.get('/issues/nearby', {
    params: { lat, lng, radius: radiusKm },
  });

  const issues = res?.data?.issues || res?.issues || [];

  if (!Array.isArray(issues)) {
    return [];
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
};

/** Get map cluster data for a bounding box */
export const getIssueClusters = async (bounds) => {
  return await getNearbyIssues();
};
