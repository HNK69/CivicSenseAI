import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useFetch — Generic data-fetching hook.
 *
 * @param {Function} serviceFunc - An async service function that returns data.
 * @param {Array}    deps        - Dependencies array (re-fetch triggers).
 * @param {*}        initialData - Initial state before first fetch.
 *
 * Returns { data, loading, error, refetch }
 *
 * Usage:
 *   const { data, loading, error } = useFetch(() => issueService.getMyIssues(), []);
 */
const useFetch = (serviceFunc, deps = [], initialData = null) => {
  const [data, setData]       = useState(initialData);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const isMounted             = useRef(true);

  const execute = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await serviceFunc();
      if (isMounted.current) setData(result);
    } catch (err) {
      if (isMounted.current) setError(err?.response?.data?.message || err.message || 'Fetch failed');
    } finally {
      if (isMounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    isMounted.current = true;
    execute();
    return () => { isMounted.current = false; };
  }, [execute]);

  return { data, loading, error, refetch: execute };
};

export default useFetch;
