import { Clock, Trash2 } from 'lucide-react';
import type { Note, PersonWithRelations } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TabsContent } from '@/components/ui/tabs';
import { formatRelative } from '@/lib/utils/time';

export function ProfileNotesTab({
  person,
  notes,
  canManage,
  isAddingNote,
  setIsAddingNote,
  noteContent,
  setNoteContent,
  noteCategory,
  setNoteCategory,
  isSubmittingNote,
  handleSaveNote,
  handleDeleteNote,
}: {
  person: PersonWithRelations;
  notes: Note[];
  canManage: boolean;
  isAddingNote: boolean;
  setIsAddingNote: (val: boolean) => void;
  noteContent: string;
  setNoteContent: (val: string) => void;
  noteCategory: string;
  setNoteCategory: (val: string) => void;
  isSubmittingNote: boolean;
  handleSaveNote: () => void;
  handleDeleteNote: (id: string) => void;
}) {
  return (
    <TabsContent value="notes" className="animate-in fade-in-50 duration-300">
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle>Pastoral & General Notes</CardTitle>
          {canManage && (
            <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
              <DialogTrigger className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90">
                Add note
              </DialogTrigger>
              <DialogContent className="rounded-2xl sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add a note for {person.first_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Select value={noteCategory} onValueChange={(val) => setNoteCategory(val || 'general')}>
                      <SelectTrigger className="w-full rounded-xl">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General</SelectItem>
                        <SelectItem value="pastoral">Pastoral</SelectItem>
                        <SelectItem value="prayer">Prayer</SelectItem>
                        <SelectItem value="follow_up">Follow Up</SelectItem>
                        <SelectItem value="visit">Visit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Textarea
                    placeholder="Type your note here..."
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    className="min-h-[120px] resize-y rounded-xl"
                  />
                  <Button
                    className="w-full rounded-xl"
                    onClick={handleSaveNote}
                    disabled={!noteContent.trim() || isSubmittingNote}
                  >
                    {isSubmittingNote ? 'Saving...' : 'Save note'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent className="pt-6">
          {notes.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">No notes found. Add one to get started.</div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {notes.map(note => (
                <div key={note.id} className="group rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-slate-50 text-xs font-medium capitalize text-slate-600">{note.category.replace('_', ' ')}</Badge>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {formatRelative(note.created_at)}
                      </span>
                    </div>
                    {canManage && (
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label="Delete note"
                        className="h-8 w-8 p-0 text-muted-foreground opacity-100 transition-all hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{note.content}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
                    <span>By {note.created_by || 'System'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  );
}
