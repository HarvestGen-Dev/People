'use client';

// <!-- AGENT: FRONTEND -->
import { Layers3, CircleDot, CheckCircle2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type {
  Workflow,
  WorkflowAdminUser,
  WorkflowBoardCard,
  WorkflowStep,
} from '@/lib/types';
import { useAdminPermissions } from '@/components/layout/AdminPermissions';

import { useKanbanBoard } from '@/hooks/useKanbanBoard';
import { KanbanColumn } from './kanban/KanbanColumn';
import { CardDetailsSidebar } from './kanban/CardDetailsSidebar';
import { KanbanDialogs } from './kanban/KanbanDialogs';

interface KanbanBoardProps {
  workflow: Workflow;
  initialSteps: WorkflowStep[];
  initialCards: WorkflowBoardCard[];
  users: WorkflowAdminUser[];
}

export function KanbanBoard({
  workflow,
  initialSteps: steps,
  initialCards: cards,
  users,
}: KanbanBoardProps) {
  const { canManage, canManageWorkflows: canManageCards } = useAdminPermissions();

  const {
    activeCard, setActiveCard,
    cardDraft, setCardDraft,
    isSavingCard,
    isAddStepOpen, setIsAddStepOpen,
    newStepName, setNewStepName,
    newStepDays, setNewStepDays,
    setInsertAfterId,
    isAddCardOpen, setIsAddCardOpen,
    setTargetStepId,
    searchQuery, setSearchQuery,
    searchResults, setSearchResults,
    selectedPersonId, setSelectedPersonId,
    cardFormData, setCardFormData,
    activeCount, completedCount,
    openCard, performSearch, handleAddStep, handleDeleteStep,
    handleAddCard, handleUpdateCard, handleCompleteCard, handleRemoveCard,
  } = useKanbanBoard(workflow, steps, cards);

  return (
    <div className="flex min-h-[calc(100vh-128px)] flex-col bg-[#f5f7f3]">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-200/80 bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-8">
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Layers3 className="h-4 w-4 text-emerald-700" />
            {steps.length} steps
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CircleDot className="h-4 w-4 text-amber-500" />
            {activeCount} active
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            {completedCount} done
          </div>
        </div>
        {canManage ? (
          <Button
            variant="outline"
            onClick={() => {
              setInsertAfterId(steps.at(-1)?.id || null);
              setIsAddStepOpen(true);
            }}
            className="h-9 rounded-xl border-slate-200 bg-white font-semibold"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add step
          </Button>
        ) : !canManageCards ? (
          <Badge variant="outline" className="w-fit bg-slate-50 text-slate-500">
            Read only
          </Badge>
        ) : null}
      </div>

      <div className="flex-1 overflow-x-auto p-4 sm:p-6 lg:p-8">
        <div className="flex min-h-[520px] gap-4 pb-4">
          {steps.map((step) => (
            <KanbanColumn
              key={step.id}
              step={step}
              cards={cards}
              canManageStructure={canManage}
              canManageCards={canManageCards}
              setInsertAfterId={setInsertAfterId}
              setIsAddStepOpen={setIsAddStepOpen}
              handleDeleteStep={handleDeleteStep}
              setTargetStepId={setTargetStepId}
              setIsAddCardOpen={setIsAddCardOpen}
              openCard={openCard}
            />
          ))}
          <KanbanColumn
            step={{ id: 'done', name: 'Completed' }}
            isDone
            cards={cards}
            canManageStructure={canManage}
            canManageCards={canManageCards}
            setInsertAfterId={setInsertAfterId}
            setIsAddStepOpen={setIsAddStepOpen}
            handleDeleteStep={handleDeleteStep}
            setTargetStepId={setTargetStepId}
            setIsAddCardOpen={setIsAddCardOpen}
            openCard={openCard}
          />
        </div>
      </div>

      {activeCard && (
        <CardDetailsSidebar
          activeCard={activeCard}
          setActiveCard={setActiveCard}
          canManage={canManageCards}
          cardDraft={cardDraft}
          setCardDraft={setCardDraft}
          steps={steps}
          users={users}
          isSavingCard={isSavingCard}
          handleUpdateCard={handleUpdateCard}
          handleCompleteCard={handleCompleteCard}
          handleRemoveCard={handleRemoveCard}
        />
      )}

      <KanbanDialogs
        canManageStructure={canManage}
        canManageCards={canManageCards}
        users={users}
        isAddStepOpen={isAddStepOpen}
        setIsAddStepOpen={setIsAddStepOpen}
        newStepName={newStepName}
        setNewStepName={setNewStepName}
        newStepDays={newStepDays}
        setNewStepDays={setNewStepDays}
        handleAddStep={handleAddStep}
        isAddCardOpen={isAddCardOpen}
        setIsAddCardOpen={setIsAddCardOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchResults={searchResults}
        setSearchResults={setSearchResults}
        selectedPersonId={selectedPersonId}
        setSelectedPersonId={setSelectedPersonId}
        performSearch={performSearch}
        cardFormData={cardFormData}
        setCardFormData={setCardFormData}
        handleAddCard={handleAddCard}
      />
    </div>
  );
}
