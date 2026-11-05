import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { displayIdFor } from '@/lib/display-ids';

export function useWorkflowIndex() {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

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
      router.push(`/workflows/${displayIdFor(data)}`);
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
    handleCreate,
  };
}
