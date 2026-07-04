'use client';

// <!-- AGENT: FRONTEND -->
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { WorkflowSummary } from '@/lib/types';
import { useAdminPermissions } from '@/components/layout/AdminPermissions';

import { useWorkflowIndex } from '@/hooks/useWorkflowIndex';
import { WorkflowStats } from './index/WorkflowStats';
import { WorkflowGrid } from './index/WorkflowGrid';
import { CreateWorkflowDialog } from './index/CreateWorkflowDialog';
import { EmptyWorkflowState } from './index/EmptyWorkflowState';

export function WorkflowIndexManager({
  initialWorkflows,
}: {
  initialWorkflows: WorkflowSummary[];
}) {
  const { canManage } = useAdminPermissions();
  const {
    isDialogOpen,
    setIsDialogOpen,
    formData,
    setFormData,
    isSaving,
    totalActive,
    totalCompleted,
    handleCreate,
  } = useWorkflowIndex(initialWorkflows);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Follow-up
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Workflows
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Give every person a clear next step, an owner, and a visible path
            forward.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800"
          >
            <Plus className="mr-2 h-4 w-4" />
            New workflow
          </Button>
        )}
      </header>

      <WorkflowStats
        totalWorkflows={initialWorkflows.length}
        totalActive={totalActive}
        totalCompleted={totalCompleted}
      />

      {initialWorkflows.length === 0 ? (
        <EmptyWorkflowState
          canManage={canManage}
          onOpenDialog={() => setIsDialogOpen(true)}
        />
      ) : (
        <WorkflowGrid workflows={initialWorkflows} />
      )}

      {canManage && (
        <CreateWorkflowDialog
          isOpen={isDialogOpen}
          setIsOpen={setIsDialogOpen}
          formData={formData}
          setFormData={setFormData}
          isSaving={isSaving}
          onSave={handleCreate}
        />
      )}
    </div>
  );
}
