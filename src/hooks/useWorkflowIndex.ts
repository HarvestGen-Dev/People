import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { WorkflowSummary } from '@/lib/types';

export function useWorkflowIndex(initialWorkflows: WorkflowSummary[]) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const totalActive = initialWorkflows.reduce(
    (sum, workflow) => sum + workflow.active_cards,
    0
  );
  const totalCompleted = initialWorkflows.reduce(
    (sum, workflow) => sum + workflow.completed_cards,
    0
  );

  const handleCreate = async () => {
    if (!formData.name.trim()) return;
    setIsSaving(true);
    try {
      const response = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!response.ok) throw new Error('Failed to create workflow');
      const { data } = await response.json();
      toast.success('Workflow created');
      router.push(`/workflows/${data.id}`);
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create workflow'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return {
    isDialogOpen,
    setIsDialogOpen,
    formData,
    setFormData,
    isSaving,
    totalActive,
    totalCompleted,
    handleCreate,
  };
}
