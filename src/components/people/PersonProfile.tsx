'use client';

import {
  PersonWithRelations,
  Note,
  PersonEvent,
  WorkflowCardWithRelations,
} from '@/lib/types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAdminPermissions } from '@/components/layout/AdminPermissions';

import { usePersonProfile } from '@/hooks/usePersonProfile';
import { ProfileOverviewTab } from './profile/ProfileOverviewTab';
import { ProfileNotesTab } from './profile/ProfileNotesTab';
import { ProfileActivityTab } from './profile/ProfileActivityTab';
import { ProfileAdminTab } from './profile/ProfileAdminTab';

interface PersonProfileProps {
  person: PersonWithRelations;
  notes: Note[];
  events: PersonEvent[];
  workflowCards: WorkflowCardWithRelations[];
}

export function PersonProfile({ person, notes, events, workflowCards }: PersonProfileProps) {
  const { canManage } = useAdminPermissions();
  const {
    currentTab,
    handleTabChange,
    pathname,
    isAddingNote,
    setIsAddingNote,
    noteContent,
    setNoteContent,
    noteCategory,
    setNoteCategory,
    isSubmittingNote,
    isDeleting,
    handleSaveNote,
    handleDeleteNote,
    handleDeletePerson,
  } = usePersonProfile(person.id);

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="mt-6 w-full">
      <TabsList variant="line" className="mb-4 flex group-data-horizontal/tabs:h-auto min-h-12 w-full flex-wrap justify-start gap-1 rounded-lg border bg-card p-1 shadow-none sm:w-fit">
        <TabsTrigger value="overview" className="min-h-11 flex-none rounded-md px-3 font-semibold data-active:font-bold data-active:text-primary">
          Overview
        </TabsTrigger>
        <TabsTrigger value="notes" className="min-h-11 flex-none rounded-md px-3 font-semibold data-active:font-bold data-active:text-primary">
          Notes <span className="ml-1.5 text-xs text-slate-400">{notes.length}</span>
        </TabsTrigger>
        <TabsTrigger value="activity" className="min-h-11 flex-none rounded-md px-3 font-semibold data-active:font-bold data-active:text-primary">
          Activity <span className="ml-1.5 text-xs text-slate-400">{events.length}</span>
        </TabsTrigger>
        {canManage && (
          <TabsTrigger value="admin" className="min-h-11 flex-none rounded-md px-3 font-semibold data-active:font-bold data-active:text-primary">
            Admin
          </TabsTrigger>
        )}
      </TabsList>

      <ProfileOverviewTab
        person={person}
        workflowCards={workflowCards}
        canManage={canManage}
        pathname={pathname}
      />

      <ProfileNotesTab
        person={person}
        notes={notes}
        canManage={canManage}
        isAddingNote={isAddingNote}
        setIsAddingNote={setIsAddingNote}
        noteContent={noteContent}
        setNoteContent={setNoteContent}
        noteCategory={noteCategory}
        setNoteCategory={setNoteCategory}
        isSubmittingNote={isSubmittingNote}
        handleSaveNote={handleSaveNote}
        handleDeleteNote={handleDeleteNote}
      />

      <ProfileActivityTab events={events} />

      <ProfileAdminTab
        person={person}
        handleDeletePerson={handleDeletePerson}
        isDeleting={isDeleting}
        canManage={canManage}
      />
    </Tabs>
  );
}
