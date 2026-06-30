'use client';

import { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { PersonWithRelations, Note, PersonEvent, WorkflowCard } from '@/lib/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRelative } from '@/lib/utils/time';
import { BookOpen, Coffee, User, Users, Trash2, Clock, CalendarDays, ExternalLink, Activity } from 'lucide-react';
import { format } from 'date-fns';

interface PersonProfileProps {
  person: PersonWithRelations;
  notes: Note[];
  events: PersonEvent[];
  workflowCards: any[];
}

export function PersonProfile({ person, notes, events, workflowCards }: PersonProfileProps) {
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
      if (res.ok) {
        setIsAddingNote(false);
        setNoteContent('');
        setNoteCategory('general');
        router.refresh();
      }
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    await fetch(`/api/admin/notes/${noteId}`, { method: 'DELETE' });
    router.refresh();
  };

  const handleDeletePerson = async () => {
    if (!confirm('Are you absolutely sure you want to delete this person? This action cannot be undone.')) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/people/${person.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/people');
      }
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
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full mt-8">
      <TabsList className="mb-6 h-12 bg-card border border-border p-1 rounded-xl shadow-sm w-full md:w-auto overflow-x-auto justify-start inline-flex">
        <TabsTrigger value="overview" className="rounded-lg px-6 h-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-medium">Overview</TabsTrigger>
        <TabsTrigger value="notes" className="rounded-lg px-6 h-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-medium">Notes</TabsTrigger>
        <TabsTrigger value="activity" className="rounded-lg px-6 h-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-medium">Activity</TabsTrigger>
        <TabsTrigger value="admin" className="rounded-lg px-6 h-full data-[state=active]:bg-red-500/10 data-[state=active]:text-red-600 font-medium">Admin</TabsTrigger>
      </TabsList>

      {/* OVERVIEW TAB */}
      <TabsContent value="overview" className="animate-in fade-in-50 duration-300">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>Personal Details</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
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
                    <div className="border-t border-border my-6 pt-6">
                      <h4 className="text-sm font-semibold text-foreground mb-4">Custom Fields</h4>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                        {person.person_field_values.map((pf: any) => (
                          <div key={pf.id}>
                            <dt className="text-sm font-medium text-muted-foreground mb-1">{pf.field_definition?.name}</dt>
                            <dd className="text-foreground">{pf.value || '—'}</dd>
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
            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Tags</CardTitle>
                  <Button variant="link" className="h-auto p-0 text-primary">Manage</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {person.person_tags && person.person_tags.length > 0 ? (
                    person.person_tags.map((pt: any) => (
                      <Badge 
                        key={pt.tag.id}
                        style={{ backgroundColor: pt.tag.color + '20', color: pt.tag.color, borderColor: pt.tag.color + '40' }}
                        className="border shadow-none py-1"
                      >
                        {pt.tag.name}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-sm text-muted-foreground">No tags assigned.</span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card shadow-sm">
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
                    <Button variant="link" className="h-auto p-0 mt-2 text-primary">View household</Button>
                  </div>
                ) : (
                  <div>
                    <span className="text-sm text-muted-foreground block mb-3">Not part of a household.</span>
                    <Button variant="outline" size="sm" className="w-full rounded-xl shadow-sm">Add to household</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border bg-card shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Workflows</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                {workflowCards.length > 0 ? (
                  <div className="space-y-3">
                    {workflowCards.map(card => (
                      <div key={card.id} className="p-3 bg-muted/50 rounded-xl border border-border">
                        <div className="font-medium text-sm text-foreground">{card.workflows?.name || 'Workflow'} <span className="text-muted-foreground font-normal mx-1">→</span> {card.workflow_steps?.name || 'Done'}</div>
                        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><User className="h-3 w-3" /> {card.assigned_to || 'Unassigned'}</span>
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {card.due_date ? format(new Date(card.due_date), 'MMM d') : 'No date'}</span>
                        </div>
                      </div>
                    ))}
                    <Button variant="link" className="h-auto p-0 w-full text-primary justify-center text-sm mt-2">View workflow board</Button>
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
        <Card className="rounded-2xl border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle>Pastoral & General Notes</CardTitle>
            <Dialog open={isAddingNote} onOpenChange={setIsAddingNote}>
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
            </Dialog>
          </CardHeader>
          <CardContent className="pt-6">
            {notes.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">No notes found. Add one to get started.</div>
            ) : (
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className="p-5 border border-border rounded-xl bg-background shadow-sm group">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-xs font-medium text-slate-600 bg-slate-50">{note.category.replace('_', ' ')}</Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatRelative(note.created_at)}
                        </span>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                        onClick={() => handleDeleteNote(note.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
        <Card className="rounded-2xl border-border bg-card shadow-sm">
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
              <div className="relative border-l-2 border-muted ml-4 pl-6 space-y-8 py-2">
                {events.map(event => (
                  <div key={event.id} className="relative">
                    <div className="absolute -left-[35px] top-1 h-8 w-8 rounded-full bg-card border-2 border-muted flex items-center justify-center">
                      {getEventIcon(event.source)}
                    </div>
                    <div className="bg-background border border-border p-4 rounded-xl shadow-sm">
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
            {events.length > 0 && (
              <div className="mt-8 text-center">
                <Button variant="outline" className="rounded-xl shadow-sm">Load more</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* ADMIN TAB */}
      <TabsContent value="admin" className="animate-in fade-in-50 duration-300">
        <Card className="rounded-2xl border-red-200 bg-red-50/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-red-700">Danger Zone</CardTitle>
            <CardDescription className="text-red-600/80">Advanced administrative actions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-white border border-red-100 rounded-xl">
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
      </TabsContent>
    </Tabs>
  );
}
