import { useState, useOptimistic, startTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import type { EventRegistration } from '@/lib/types';

export type RegistrationFilter = 'all' | 'pending_review' | 'approved' | 'rejected';

export function useRegistrationsTable(
  registrations: EventRegistration[],
  serverStatusCounts?: { all: number; pending_review: number; approved: number; rejected: number },
  currentFilter?: string
) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  // Optimistic UI updates for ultra-fast perceived performance
  const [optimisticRegistrations, setOptimisticRegistrations] = useOptimistic(
    registrations,
    (state, action: { id: string; status: 'approved' | 'rejected' } | { ids: string[]; status: 'approved' }) => {
      if ('ids' in action) {
        return state.map((r) => 
          action.ids.includes(r.id) ? { ...r, status: action.status } : r
        );
      }
      return state.map((r) => 
        r.id === action.id ? { ...r, status: action.status } : r
      );
    }
  );

  // If serverStatusCounts are provided, we're in server-side pagination mode
  const isServerSide = !!serverStatusCounts;
  
  // Local state for client-side filtering fallback
  const [localFilter, setLocalFilter] = useState<RegistrationFilter>('pending_review');
  const filter = (isServerSide ? (currentFilter as RegistrationFilter) || 'all' : localFilter);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [proofLoadingIds, setProofLoadingIds] = useState<Set<string>>(new Set());
  
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const filteredRegistrations = isServerSide 
    ? optimisticRegistrations 
    : optimisticRegistrations.filter((r) => filter === 'all' || r.status === filter);
  
  const statusCounts = serverStatusCounts || {
    all: optimisticRegistrations.length,
    pending_review: optimisticRegistrations.filter((r) => r.status === 'pending_review').length,
    approved: optimisticRegistrations.filter((r) => r.status === 'approved').length,
    rejected: optimisticRegistrations.filter((r) => r.status === 'rejected').length,
  };

  const setFilter = (newFilter: RegistrationFilter) => {
    if (isServerSide) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('status', newFilter);
      params.set('page', '1'); // Reset to page 1 on filter change
      router.push(`${pathname}?${params.toString()}`);
    } else {
      setLocalFilter(newFilter);
    }
  };

  const updateLoading = (ids: string[], loading: boolean) => {
    setLoadingIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
        if (loading) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };

  const handleApprove = async (id: string) => {
    startTransition(() => {
      setOptimisticRegistrations({ id, status: 'approved' });
    });
    updateLoading([id], true);
    
    try {
      const response = await fetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' });
      if (!response.ok) throw new Error('Failed to approve');
      toast.success('Approved — confirmation email sent');
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to approve');
      router.refresh(); // Revert optimistic update
    } finally {
      updateLoading([id], false);
    }
  };

  const handleReject = async () => {
    if (!rejectDialogId) return;
    const id = rejectDialogId;
    
    startTransition(() => {
      setOptimisticRegistrations({ id, status: 'rejected' });
    });
    setRejectDialogId(null);
    setRejectReason('');
    updateLoading([id], true);
    
    try {
      const response = await fetch(`/api/admin/registrations/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!response.ok) throw new Error('Failed to reject');
      toast.success('Registration rejected');
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to reject');
      router.refresh(); // Revert optimistic update
    } finally {
      updateLoading([id], false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    
    startTransition(() => {
      setOptimisticRegistrations({ ids, status: 'approved' });
    });
    setSelectedIds(new Set());
    updateLoading(ids, true);
    
    try {
      const response = await fetch('/api/admin/registrations/bulk-approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!response.ok) throw new Error('Bulk approve failed');
      toast.success(`Approved ${ids.length} registrations`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Bulk approval failed');
      router.refresh(); // Revert optimistic update
    } finally {
      updateLoading(ids, false);
    }
  };

  const handleViewProof = async (id: string) => {
    setProofLoadingIds((current) => new Set(current).add(id));

    try {
      const response = await fetch(`/api/admin/registrations/${id}/proof`);
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || 'Failed to load payment proof');
      }

      setLightboxUrl(payload.data.url);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to load payment proof');
    } finally {
      setProofLoadingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRegistrations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRegistrations.map((r) => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return {
    filter, setFilter,
    selectedIds, setSelectedIds,
    loadingIds, setLoadingIds,
    proofLoadingIds,
    rejectDialogId, setRejectDialogId,
    rejectReason, setRejectReason,
    lightboxUrl, setLightboxUrl,
    filteredRegistrations,
    statusCounts,
    handleApprove,
    handleReject,
    handleBulkApprove,
    handleViewProof,
    toggleSelectAll,
    toggleSelect,
  };
}
