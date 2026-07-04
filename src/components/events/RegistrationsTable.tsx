'use client';

// <!-- AGENT: FRONTEND -->
import dynamic from 'next/dynamic';
import type { EventRegistration } from '@/lib/types';
import { useRegistrationsTable } from '@/hooks/useRegistrationsTable';
import { RegistrationStats } from './registrations/RegistrationStats';
import { RegistrationFilters } from './registrations/RegistrationFilters';
import { RegistrationList } from './registrations/RegistrationList';

// Lazy load dialogs/modals since they aren't needed on initial render
const RegistrationDialogs = dynamic(
  () => import('./registrations/RegistrationDialogs').then(mod => mod.RegistrationDialogs),
  { ssr: false }
);

export function RegistrationsTable({
  registrations,
  isFreeEvent,
  serverStatusCounts,
  currentFilter,
}: {
  registrations: EventRegistration[];
  isFreeEvent: boolean;
  serverStatusCounts?: { all: number; pending_review: number; approved: number; rejected: number };
  currentFilter?: string;
}) {
  const {
    filter,
    setFilter,
    selectedIds,
    setSelectedIds,
    loadingIds,
    rejectDialogId,
    setRejectDialogId,
    rejectReason,
    setRejectReason,
    lightboxUrl,
    setLightboxUrl,
    filteredRegistrations,
    statusCounts,
    handleApprove,
    handleReject,
    handleBulkApprove,
    toggleSelectAll,
    toggleSelect,
  } = useRegistrationsTable(registrations, serverStatusCounts, currentFilter);

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">
          Attendees
        </div>
        <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">
          Registration review
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Verify submissions, approve payments, and keep the attendee list
          accurate.
        </p>
      </header>

      <RegistrationStats counts={statusCounts} />

      <RegistrationFilters
        filter={filter}
        setFilter={setFilter}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        statusCounts={statusCounts}
        handleBulkApprove={handleBulkApprove}
      />

      <RegistrationList
        filteredRegistrations={filteredRegistrations}
        filter={filter}
        isFreeEvent={isFreeEvent}
        selectedIds={selectedIds}
        loadingIds={loadingIds}
        toggleSelect={toggleSelect}
        toggleSelectAll={toggleSelectAll}
        handleApprove={handleApprove}
        setRejectDialogId={setRejectDialogId}
        setLightboxUrl={setLightboxUrl}
      />

      <RegistrationDialogs
        rejectDialogId={rejectDialogId}
        setRejectDialogId={setRejectDialogId}
        rejectReason={rejectReason}
        setRejectReason={setRejectReason}
        handleReject={handleReject}
        loadingIds={loadingIds}
        lightboxUrl={lightboxUrl}
        setLightboxUrl={setLightboxUrl}
      />
    </div>
  );
}
