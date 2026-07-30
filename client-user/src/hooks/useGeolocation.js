import { useState, useEffect } from 'react';

/**
 * useGeolocation — Auto-captures browser GPS position.
 * Returns { coords, error, loading, refetch }
 *
 * coords: { latitude, longitude, accuracy, formattedString }
 */
const useGeolocation = (options = {}) => {
  const [coords, setCoords]   = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchPosition = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by this browser.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        setCoords({
          latitude,
          longitude,
          accuracy,
          formattedString: `${latitude.toFixed(4)}° N, ${longitude.toFixed(4)}° E`,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Unable to retrieve location.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0, ...options }
    );
  };

  useEffect(() => {
    fetchPosition();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { coords, error, loading, refetch: fetchPosition };
};

export default useGeolocation;
