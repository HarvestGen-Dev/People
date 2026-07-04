import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';

export function usePersonProfile(personId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const currentTab = searchParams.get('tab') || 'overview';

  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteContent, setNoteContent] = useState('');
  const [noteCategory, setNoteCategory] = useState('general');
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleTabChange = (val: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', val);
    router.replace(`${pathname}?${params.toString()}`);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;
    setIsSubmittingNote(true);
    try {
      const res = await fetch('/api/admin/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          person_id: personId,
          content: noteContent,
          category: noteCategory,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Unable to save note');
      
      setIsAddingNote(false);
      setNoteContent('');
      setNoteCategory('general');
      toast.success('Note added');
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to save note');
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      const response = await fetch(`/api/admin/notes/${noteId}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || 'Unable to delete note');
      }
      toast.success('Note deleted');
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete note');
    }
  };

  const handleDeletePerson = async () => {
    if (!confirm('Are you absolutely sure you want to delete this person? This action cannot be undone.')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/people/${personId}`, { method: 'DELETE' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Unable to delete person');
      toast.success('Person deleted');
      router.push('/people');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Unable to delete person');
    } finally {
      setIsDeleting(false);
    }
  };

  return {
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
  };
}
