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
      <TabsList className="mb-6 inline-flex h-12 w-full justify-start overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-none md:w-auto">
        <TabsTrigger value="overview" className="h-full rounded-xl px-5 font-semibold data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800">
          Overview
        </TabsTrigger>
        <TabsTrigger value="notes" className="h-full rounded-xl px-5 font-semibold data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800">
          Notes <span className="ml-1.5 text-xs text-slate-400">{notes.length}</span>
        </TabsTrigger>
        <TabsTrigger value="activity" className="h-full rounded-xl px-5 font-semibold data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800">
          Activity <span className="ml-1.5 text-xs text-slate-400">{events.length}</span>
        </TabsTrigger>
        {canManage && (
          <TabsTrigger value="admin" className="h-full rounded-xl px-5 font-semibold data-[state=active]:bg-red-50 data-[state=active]:text-red-700">
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
