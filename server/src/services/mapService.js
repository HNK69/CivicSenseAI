/**
 * mapService.js — MongoDB geo query helpers.
 * No external geocoding API — only Mongoose $near / $geoWithin helpers.
 */

/**
 * buildGeoPoint — returns a GeoJSON Point object from lat/lng.
 * Note: GeoJSON uses [longitude, latitude] order.
 */
const buildGeoPoint = (lat, lng) => ({
  type: 'Point',
  coordinates: [parseFloat(lng), parseFloat(lat)],
});

/**
 * nearbyFilter — builds a Mongoose $near filter for the `location` field.
 * @param {number} lat
 * @param {number} lng
 * @param {number} radiusKm — search radius in kilometres (default 2)
 */
const nearbyFilter = (lat, lng, radiusKm = 2) => ({
  location: {
    $near: {
      $geometry:    { type: 'Point', coordinates: [parseFloat(lng), parseFloat(lat)] },
      $maxDistance: radiusKm * 1000, // metres
    },
  },
});

/**
 * withinBoxFilter — builds a Mongoose $geoWithin filter for a bounding box.
 * @param {number} swLat — south-west latitude
 * @param {number} swLng — south-west longitude
 * @param {number} neLat — north-east latitude
 * @param {number} neLng — north-east longitude
 */
const withinBoxFilter = (swLat, swLng, neLat, neLng) => ({
  location: {
    $geoWithin: {
      $box: [
        [parseFloat(swLng), parseFloat(swLat)],
        [parseFloat(neLng), parseFloat(neLat)],
      ],
    },
  },
});

/**
 * haversineDistanceKm — straight-line distance between two lat/lng points.
 * Useful for secondary filtering or display purposes.
 */
const haversineDistanceKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth radius km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

module.exports = { buildGeoPoint, nearbyFilter, withinBoxFilter, haversineDistanceKm };
