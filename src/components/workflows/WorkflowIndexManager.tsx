'use client';

// <!-- AGENT: FRONTEND -->
import { Plus } from 'lucide-react';
import { useWorkflowIndex } from '@/hooks/useWorkflowIndex';
import { CreateWorkflowDialog } from './index/CreateWorkflowDialog';

export function WorkflowIndexManager() {
  const {
    isDialogOpen, setIsDialogOpen, formData, setFormData, isSaving, handleCreate,
  } = useWorkflowIndex();

  return (
    <>
      <button type="button" className="workspace-button" data-primary onClick={() => setIsDialogOpen(true)}>
        <Plus size={16} aria-hidden="true" /> New workflow
      </button>
      {isDialogOpen && <CreateWorkflowDialog isOpen={isDialogOpen} setIsOpen={setIsDialogOpen}
        formData={formData} setFormData={setFormData} isSaving={isSaving} onSave={handleCreate} />}
    </>
  );
}
