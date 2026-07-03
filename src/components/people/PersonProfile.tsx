'use client';

import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  PersonWithRelations,
  Note,
  PersonEvent,
  WorkflowCardWithRelations,
} from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRelative } from '@/lib/utils/time';
import { BookOpen, Coffee, User, Users, Trash2, Clock, CalendarDays, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAdminPermissions } from '@/components/layout/AdminPermissions';

interface PersonProfileProps {
  person: PersonWithRelations;
  notes: Note[];
  events: PersonEvent[];
  workflowCards: WorkflowCardWithRelations[];
}

export function PersonProfile({ person, notes, events, workflowCards }: PersonProfileProps) {
  const { canManage } = useAdminPermissions();
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
          person_id: person.id,
          content: noteContent,
          category: noteCategory
        })
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
    const response = await fetch(`/api/admin/notes/${noteId}`, { method: 'DELETE' });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      toast.error(body?.error || 'Unable to delete note');
      return;
    }
    toast.success('Note deleted');
    router.refresh();
  };

  const handleDeletePerson = async () => {
    if (!confirm('Are you absolutely sure you want to delete this person? This action cannot be undone.')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/people/${person.id}`, { method: 'DELETE' });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || 'Unable to delete person');
      toast.success('Person deleted');
      router.push('/people');
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Unable to delete person'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const getEventIcon = (source: string) => {
    switch (source) {
      case 'shepherd': return <BookOpen className="h-5 w-5 text-indigo-500" />;
      case 'drip_brew': return <Coffee className="h-5 w-5 text-amber-600" />;
      case 'manual': return <User className="h-5 w-5 text-slate-500" />;
      case 'people': return <Users className="h-5 w-5 text-emerald-500" />;
      default: return <Activity className="h-5 w-5 text-primary" />;
    }
  };

  const formatEventName = (eventType: string) => {
    return eventType.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="mt-6 w-full">
      <TabsList className="mb-6 inline-flex h-12 w-full justify-start overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1 shadow-none md:w-auto">
        <TabsTrigger value="overview" className="h-full rounded-xl px-5 font-semibold data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800">Overview</TabsTrigger>
        <TabsTrigger value="notes" className="h-full rounded-xl px-5 font-semibold data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800">Notes <span className="ml-1.5 text-xs text-slate-400">{notes.length}</span></TabsTrigger>
        <TabsTrigger value="activity" className="h-full rounded-xl px-5 font-semibold data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-800">Activity <span className="ml-1.5 text-xs text-slate-400">{events.length}</span></TabsTrigger>
        {canManage && (
          <TabsTrigger value="admin" className="h-full rounded-xl px-5 font-semibold data-[state=active]:bg-red-50 data-[state=active]:text-red-700">Admin</TabsTrigger>
        )}
      </TabsList>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="animate-in fade-in-50 duration-300">
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
              <CardHeader className="border-b border-slate-100">
                <CardTitle className="text-lg font-bold text-slate-950">Personal details</CardTitle>
                <CardDescription>Contact and demographic information for this person.</CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:rounded-2xl [&>div]:bg-slate-50/80 [&>div]:p-4 [&_dd]:mt-1.5 [&_dd]:font-semibold [&_dd]:text-slate-900 [&_dt]:text-[10px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-[0.13em] [&_dt]:text-slate-400">
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Full Name</dt>
                    <dd className="text-foreground font-medium">{person.first_name} {person.last_name}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Email</dt>
                    <dd className="text-foreground">{person.email || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Phone</dt>
                    <dd className="text-foreground">{person.phone || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Gender</dt>
                    <dd className="text-foreground capitalize">{person.gender?.replace(/_/g, ' ') || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Birthdate</dt>
                    <dd className="text-foreground">{person.birthdate ? format(new Date(person.birthdate), 'MMM d, yyyy') : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Marital Status</dt>
                    <dd className="text-foreground capitalize">{person.marital_status || '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Anniversary</dt>
                    <dd className="text-foreground">{person.anniversary ? format(new Date(person.anniversary), 'MMM d, yyyy') : '—'}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-muted-foreground mb-1">Campus</dt>
                    <dd className="text-foreground">{person.campus || '—'}</dd>
                  </div>
                </dl>
                
                {person.person_field_values && person.person_field_values.length > 0 && (
                  <>
                    <div className="mt-6 border-t border-slate-100 pt-6">
                      <h4 className="mb-4 text-sm font-bold text-slate-900">Custom fields</h4>
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:rounded-2xl [&>div]:border [&>div]:border-slate-100 [&>div]:p-4 [&_dd]:mt-1.5 [&_dd]:font-semibold [&_dd]:text-slate-900 [&_dt]:text-[10px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-[0.13em] [&_dt]:text-slate-400">
                        {person.person_field_values.map((fieldValue) => (
                          <div key={fieldValue.id}>
                            <dt className="text-sm font-medium text-muted-foreground mb-1">{fieldValue.field_definition?.name}</dt>
                            <dd className="text-foreground">{fieldValue.value || '—'}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Tags</CardTitle>
                  {canManage && (
                    <Button variant="link" onClick={() => router.push(`${pathname}/edit`)} className="h-auto p-0 text-emerald-700">Manage</Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {person.person_tags && person.person_tags.length > 0 ? (
                    person.person_tags.map((personTag) =>
                      personTag.tag ? (
                        <Badge
                          key={personTag.tag.id}
                          style={{ backgroundColor: personTag.tag.color + '20', color: personTag.tag.color, borderColor: personTag.tag.color + '40' }}
                          className="border shadow-none py-1"
                        >
                          {personTag.tag.name}
                        </Badge>
                      ) : null
                    )
                  ) : (
                    <span className="text-sm text-muted-foreground">No tags assigned.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Household</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {person.household ? (
                  <div>
                    <div className="font-semibold text-foreground flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" /> {person.household.name}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">Household relationship</p>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-3">Not part of a household.</span>
                    {canManage && (
                      <Button variant="outline" size="sm" onClick={() => router.push(`${pathname}/edit`)} className="w-full rounded-xl shadow-sm">Add to household</Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Workflows</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {workflowCards.length > 0 ? (
                  <div className="space-y-3">
                    {workflowCards.map(card => (
                      <div key={card.id} className="rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
                        <div className="font-medium text-sm text-foreground">{card.workflows?.name || 'Workflow'} <span className="text-muted-foreground font-normal mx-1">→</span> {card.workflow_steps?.name || 'Done'}</div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {card.assigned_to || 'Unassigned'}</span>
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {card.due_date ? format(new Date(card.due_date), 'MMM d') : 'No date'}</span>
                        </div>
                      </div>
                    ))}
                    <Button variant="link" onClick={() => router.push('/workflows')} className="mt-2 h-auto w-full justify-center p-0 text-sm text-emerald-700">View workflow board</Button>
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground">No active workflows.</span>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      {/* NOTES TAB */}
      <TabsContent value="notes" className="animate-in fade-in-50 duration-300">
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle>Pastoral & General Notes</CardTitle>
            {canManage && <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
              <DialogTrigger className="rounded-xl shadow-sm bg-primary hover:bg-primary/90 inline-flex items-center justify-center whitespace-nowrap text-sm font-medium h-9 px-4 py-2 text-primary-foreground">
                Add note
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px] rounded-2xl">
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
                    className="min-h-[120px] rounded-xl resize-y"
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
            </Dialog>}
          </CardHeader>
          <CardContent className="pt-6">
            {notes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No notes found. Add one to get started.</div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {notes.map(note => (
                  <div key={note.id} className="group rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-xs font-medium text-slate-600 bg-slate-50">{note.category.replace('_', ' ')}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatRelative(note.created_at)}
                        </span>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Delete note"
                          className="h-8 w-8 p-0 text-muted-foreground opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-foreground whitespace-pre-wrap text-sm leading-relaxed">{note.content}</p>
                    <div className="mt-3 pt-3 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
                      <span>By {note.created_by || 'System'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ACTIVITY TAB */}
      <TabsContent value="activity" className="animate-in fade-in-50 duration-300">
        <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
          <CardHeader className="border-b border-border pb-4">
            <CardTitle>Timeline Activity</CardTitle>
            <CardDescription>A chronological view of all events from connected integrations and the CRM.</CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {events.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-xl bg-muted/30">
                <Activity className="h-8 w-8 mx-auto mb-3 text-muted-foreground/50" />
                <p>No activity yet.</p>
                <p className="text-sm mt-1">Events from Shepherd and Drip & Brew will appear here automatically.</p>
              </div>
            ) : (
              <div className="relative ml-4 space-y-8 border-l-2 border-emerald-100 py-2 pl-6">
                {events.map(event => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[35px] top-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-emerald-100 bg-white">
                      {getEventIcon(event.source)}
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="font-semibold text-foreground text-base">
                          {formatEventName(event.event_type)}
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">{format(new Date(event.occurred_at), 'MMM d, yyyy h:mm a')}</span>
                      </div>
                      <Badge variant="secondary" className="capitalize text-xs mb-3 shadow-none bg-muted font-medium">{event.source.replace('_', ' ')}</Badge>
                      
                      {event.metadata && Object.keys(event.metadata).length > 0 && (
                        <div className="bg-muted/40 rounded-lg p-3 text-sm font-mono text-muted-foreground">
                          {Object.entries(event.metadata).map(([k, v]) => (
                            <div key={k} className="flex gap-2">
                              <span className="font-semibold text-slate-500">{k}:</span>
                              <span className="text-slate-700">{String(v)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ADMIN TAB */}
      {canManage && <TabsContent value="admin" className="animate-in fade-in-50 duration-300">
        <Card className="rounded-3xl border-red-200 bg-red-50/50 shadow-none">
          <CardHeader>
            <CardTitle className="text-red-700">Danger Zone</CardTitle>
            <CardDescription className="text-red-600/80">Advanced administrative actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-red-100 bg-white p-5 sm:flex-row sm:items-center">
              <div>
                <h4 className="font-semibold text-foreground">Delete this person</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  Permanently remove {person.first_name} and all their associated data. This action cannot be undone.
                </p>
              </div>
              <Button variant="destructive" onClick={handleDeletePerson} disabled={isDeleting} className="rounded-xl shadow-sm">
                {isDeleting ? 'Deleting...' : 'Delete Person'}
              </Button>
            </div>

            <div className="p-4 bg-white border border-border rounded-xl">
              <h4 className="font-semibold text-foreground mb-3">System Identifiers</h4>
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground block mb-1">Person ID</span>
                  <code className="bg-slate-100 px-2 py-1 rounded text-slate-700">{person.id}</code>
                </div>
                <div>
                  <span className="text-muted-foreground block mb-1">Created At</span>
                  <div className="text-foreground">{format(new Date(person.created_at), 'PPpp')}</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>}
    </Tabs>
  );
}
