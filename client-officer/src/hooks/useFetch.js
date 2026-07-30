import { useState, useEffect } from 'react';

/**
 * useFetch — generic hook for async data loading.
 *
 * @param {Function} fetchFn  - async function from services/ returning data
 * @param {any[]}    deps     - re-run when these values change
 * @returns {{ data, loading, error, refetch }}
 *
 * Example:
 *   const { data, loading } = useFetch(() => issueService.getIssues(), []);
 *
 * Integration: service functions currently return mock data.
 * When backend is ready, swap the service implementation — this hook needs no changes.
 */
export function useFetch(fetchFn, deps = []) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const execute = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchFn();
      setData(result);
    } catch (err) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (fetchFn) execute(); }, deps);

  return { data, loading, error, refetch: execute };
}
