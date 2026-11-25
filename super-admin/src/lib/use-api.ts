'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch } from './http';

/**
 * Loads an admin API path and keeps it fresh. Pass null to wait (e.g. until an id is known).
 * `setData` lets a page show the response of an action without another request.
 */
export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const latest = useRef(0);

  const load = useCallback(async () => {
    if (!path) return;
    const request = ++latest.current;
    setLoading(true);
    try {
      const result = await apiFetch<T>(path);
      if (request === latest.current) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      if (request === latest.current) setError(err);
    } finally {
      if (request === latest.current) setLoading(false);
    }
  }, [path]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, error, loading, reload: load, setData };
}

/** Keeps list filters in the address bar so a page can be shared or reloaded. */
export function useQueryState<T extends Record<string, string>>(defaults: T) {
  const [state, setState] = useState<T>(defaults);
  // Read the address bar after the first render, so server and browser render the same HTML.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const found: Record<string, string> = {};
    for (const key of Object.keys(defaults)) {
      const value = params.get(key);
      if (value !== null) found[key] = value;
    }
    if (Object.keys(found).length) setState((current) => ({ ...current, ...found }));
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = useCallback((patch: Partial<T>) => {
    setState((current) => {
      const next = { ...current, ...patch };
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
      const query = params.toString();
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${query ? `?${query}` : ''}`,
      );
      return next;
    });
  }, []);
  return [state, update] as const;
}
