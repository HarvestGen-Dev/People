import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type {
  ListPerson,
  Workflow,
  WorkflowBoardCard,
  WorkflowStep,
} from '@/lib/types';

export type CardDraft = {
  current_step_id: string;
  assigned_to: string;
  due_date: string;
  notes: string;
};

export type CardFormData = {
  assigned_to: string;
  due_date: string;
  notes: string;
};

const emptyDraft: CardDraft = {
  current_step_id: '',
  assigned_to: 'unassigned',
  due_date: '',
  notes: '',
};

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'An unexpected error occurred';

export function useKanbanBoard(
  workflow: Workflow,
  steps: WorkflowStep[],
  cards: WorkflowBoardCard[]
) {
  const router = useRouter();

  const [activeCard, setActiveCard] = useState<WorkflowBoardCard | null>(null);
  const [cardDraft, setCardDraft] = useState<CardDraft>(emptyDraft);
  const [isSavingCard, setIsSavingCard] = useState(false);

  const [isAddStepOpen, setIsAddStepOpen] = useState(false);
  const [newStepName, setNewStepName] = useState('');
  const [newStepDays, setNewStepDays] = useState('3');
  const [insertAfterId, setInsertAfterId] = useState<string | null>(null);

  const [isAddCardOpen, setIsAddCardOpen] = useState(false);
  const [targetStepId, setTargetStepId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ListPerson[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [cardFormData, setCardFormData] = useState<CardFormData>({
    assigned_to: 'unassigned',
    due_date: '',
    notes: '',
  });

  const activeCount = cards.filter((card) => !card.completed_at).length;
  const completedCount = cards.filter((card) => card.completed_at).length;

  const openCard = (card: WorkflowBoardCard) => {
    setActiveCard(card);
    setCardDraft({
      current_step_id: card.current_step_id || '',
      assigned_to: card.assigned_to || 'unassigned',
      due_date: card.due_date ? card.due_date.split('T')[0] : '',
      notes: card.notes || '',
    });
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    try {
      const response = await fetch(
        `/api/admin/people/search?q=${encodeURIComponent(query)}`
      );
      if (response.ok) {
        const { data } = await response.json();
        setSearchResults(data);
      }
    } catch {
      setSearchResults([]);
    }
  };

  const handleAddStep = async () => {
    if (!newStepName.trim()) return;
    try {
      const currentIndex = steps.findIndex((step) => step.id === insertAfterId);
      const previousPosition =
        currentIndex >= 0 ? steps[currentIndex].position : 0;
      const nextPosition =
        currentIndex + 1 < steps.length
          ? steps[currentIndex + 1].position
          : previousPosition + 1000;
      const position = insertAfterId
        ? previousPosition + (nextPosition - previousPosition) / 2
        : 1000;

      const response = await fetch('/api/admin/workflow-steps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflow.id,
          name: newStepName,
          position,
          default_days_to_complete: parseInt(newStepDays, 10) || 3,
        }),
      });
      if (!response.ok) throw new Error('Failed to create step');
      toast.success('Step added');
      setIsAddStepOpen(false);
      setNewStepName('');
      setNewStepDays('3');
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleDeleteStep = async (stepId: string) => {
    const stepCards = cards.filter(
      (card) => card.current_step_id === stepId && !card.completed_at
    );
    if (stepCards.length > 0) {
      toast.error('Move or complete active cards before deleting this step');
      return;
    }
    if (!confirm('Delete this workflow step?')) return;
    try {
      const response = await fetch(`/api/admin/workflow-steps/${stepId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete step');
      toast.success('Step deleted');
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleAddCard = async () => {
    if (!selectedPersonId || !targetStepId) return;
    try {
      const response = await fetch('/api/admin/workflow-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: workflow.id,
          current_step_id: targetStepId,
          person_id: selectedPersonId,
          assigned_to:
            cardFormData.assigned_to === 'unassigned'
              ? null
              : cardFormData.assigned_to,
          due_date: cardFormData.due_date || null,
          notes: cardFormData.notes || null,
        }),
      });
      if (!response.ok) throw new Error('Failed to add card');
      toast.success('Person added to workflow');
      setIsAddCardOpen(false);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedPersonId(null);
      setCardFormData({
        assigned_to: 'unassigned',
        due_date: '',
        notes: '',
      });
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleUpdateCard = async () => {
    if (!activeCard) return;
    setIsSavingCard(true);
    const updates = {
      current_step_id: cardDraft.current_step_id || null,
      assigned_to:
        cardDraft.assigned_to === 'unassigned'
          ? null
          : cardDraft.assigned_to,
      due_date: cardDraft.due_date || null,
      notes: cardDraft.notes || null,
    };
    try {
      const response = await fetch(
        `/api/admin/workflow-cards/${activeCard.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updates),
        }
      );
      if (!response.ok) throw new Error('Failed to update card');
      toast.success('Card updated');
      setActiveCard({ ...activeCard, ...updates });
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    } finally {
      setIsSavingCard(false);
    }
  };

  const handleCompleteCard = async () => {
    if (!activeCard) return;
    try {
      const response = await fetch(
        `/api/admin/workflow-cards/${activeCard.id}/complete`,
        { method: 'POST' }
      );
      if (!response.ok) throw new Error('Failed to complete card');
      toast.success('Marked as complete');
      setActiveCard(null);
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  const handleRemoveCard = async () => {
    if (!activeCard || !confirm('Remove this person from the workflow?')) return;
    try {
      const response = await fetch(
        `/api/admin/workflow-cards/${activeCard.id}`,
        { method: 'DELETE' }
      );
      if (!response.ok) throw new Error('Failed to remove card');
      toast.success('Removed from workflow');
      setActiveCard(null);
      router.refresh();
    } catch (error: unknown) {
      toast.error(errorMessage(error));
    }
  };

  return {
    activeCard, setActiveCard,
    cardDraft, setCardDraft,
    isSavingCard,
    isAddStepOpen, setIsAddStepOpen,
    newStepName, setNewStepName,
    newStepDays, setNewStepDays,
    insertAfterId, setInsertAfterId,
    isAddCardOpen, setIsAddCardOpen,
    targetStepId, setTargetStepId,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    selectedPersonId, setSelectedPersonId,
    cardFormData, setCardFormData,
    activeCount, completedCount,
    openCard, performSearch, handleAddStep, handleDeleteStep,
    handleAddCard, handleUpdateCard, handleCompleteCard, handleRemoveCard,
  };
}
