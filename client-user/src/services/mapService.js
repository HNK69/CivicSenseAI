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
  try {
    const res = await api.get('/issues/nearby', {
      params: { lat, lng, radius: radiusKm },
    });

    const rawList = res?.data?.issues || res?.data?.docs || res?.data || res?.issues || res || [];
    const issues = Array.isArray(rawList) ? rawList : [];

    return issues.map(item => {
      const coords = item.location?.coordinates || [lng, lat];
      const severity = (item.priority || item.aiMeta?.priority || 'medium').toLowerCase();

      return {
        id: item._id || item.id,
        _id: item._id || item.id,
        title: item.title || 'Civic Issue',
        category: item.category || 'General',
        status: item.status || 'reported',
        severity: ['high', 'medium', 'low'].includes(severity) ? severity : 'medium',
        lat: coords[1] !== undefined ? coords[1] : lat,
        lng: coords[0] !== undefined ? coords[0] : lng,
        address: item.address || 'Ballari, Karnataka',
      };
    });
  } catch (err) {
    console.warn('[mapService] getNearbyIssues failed:', err?.message);
    return [];
  }
};

/** Get map cluster data for a bounding box */
export const getIssueClusters = async (bounds) => {
  return await getNearbyIssues();
};
