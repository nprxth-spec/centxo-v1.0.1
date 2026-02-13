'use client';

import { useState, useCallback } from 'react';

const DEFAULT_PAGE_SIZE = 50;

export interface UsePaginatedListOptions<T> {
  pageSize?: number;
  fetchFn: (opts: { limit: number; offset: number }) => Promise<{ items: T[]; total: number }>;
  formatItem?: (raw: unknown) => T;
}

export interface UsePaginatedListReturn<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  page: number;
  total: number;
  pageSize: number;
  hasMore: boolean;
  loadPage: (page: number) => Promise<void>;
  setPage: (page: number) => void;
  reset: () => void;
}

/**
 * Standard paginated list hook - 50 rows per page.
 * @see docs/DATA_MANAGEMENT_STANDARD.md
 */
export function usePaginatedList<T = unknown>(
  options: UsePaginatedListOptions<T>
): UsePaginatedListReturn<T> {
  const { pageSize = DEFAULT_PAGE_SIZE, fetchFn, formatItem } = options;
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPageState] = useState(1);
  const [total, setTotal] = useState(0);

  const loadPage = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const { items: rawItems, total: t } = await fetchFn({
          limit: pageSize,
          offset: (p - 1) * pageSize,
        });
        const formatted = formatItem
          ? (rawItems as unknown[]).map((r) => formatItem(r))
          : (rawItems as T[]);
        setItems(formatted);
        setTotal(t);
        setPageState(p);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [fetchFn, formatItem, pageSize]
  );

  const setPage = useCallback((p: number) => {
    setPageState(p);
  }, []);

  const reset = useCallback(() => {
    setPageState(1);
    setItems([]);
    setTotal(0);
  }, []);

  const hasMore = page * pageSize < total;

  return {
    items,
    loading,
    error,
    page,
    total,
    pageSize,
    hasMore,
    loadPage,
    setPage,
    reset,
  };
}
