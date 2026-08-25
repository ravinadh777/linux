import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';
import { toast } from '../../stores/toastStore.js';
import { apiError } from '../../lib/api.js';

// ─────────────────────────────────────────────────────────────────────────────
// Data hook for the seven citizen-record collections (vehicles, properties,
// employment, family, wallet, messages, business).
//
// One hook rather than seven, matching the single backend service. Every screen
// gets identical loading/error/empty semantics and identical cache invalidation,
// so a record added on one screen updates the sidebar badge and dashboard counts
// without any screen knowing about the others.
//
// All data is REAL: these call the live /vehicles, /properties … endpoints. A fresh
// account legitimately returns [] and the screen shows its empty state.
// ─────────────────────────────────────────────────────────────────────────────

export function useRecords(collection) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: [collection],
    queryFn: () => api.get(`/${collection}`).then((r) => r.data.items || []),
  });

  /** Anything that changes a record also refreshes the badge + dashboard counts. */
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [collection] });
    qc.invalidateQueries({ queryKey: ['records-summary'] });
  };

  const create = useMutation({
    mutationFn: (body) => api.post(`/${collection}`, body).then((r) => r.data),
    onSuccess: () => { invalidate(); toast.success('Saved.'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const update = useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/${collection}/${id}`, body).then((r) => r.data),
    onSuccess: () => { invalidate(); toast.success('Updated.'); },
    onError: (e) => toast.error(apiError(e)),
  });

  const remove = useMutation({
    mutationFn: (id) => api.delete(`/${collection}/${id}`).then((r) => r.data),
    onSuccess: () => { invalidate(); toast.success('Removed.'); },
    onError: (e) => toast.error(apiError(e)),
  });

  return {
    items: list.data || [],
    isLoading: list.isLoading,
    error: list.error,
    refetch: list.refetch,
    create, update, remove,
    saving: create.isPending || update.isPending,
  };
}

/** Aggregate counts — powers the dashboard tiles and the sidebar badge. */
export function useRecordsSummary() {
  return useQuery({
    queryKey: ['records-summary'],
    queryFn: () => api.get('/records/summary').then((r) => r.data),
    staleTime: 60_000,
    retry: false,
  });
}
