import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { CalendarDays, User, Users } from 'lucide-react';
import type { PersonWithRelations, WorkflowCardWithRelations } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TabsContent } from '@/components/ui/tabs';

export function ProfileOverviewTab({
  person,
  workflowCards,
  canManage,
  pathname,
}: {
  person: PersonWithRelations;
  workflowCards: WorkflowCardWithRelations[];
  canManage: boolean;
  pathname: string;
}) {
  const router = useRouter();

  return (
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
                  <dt className="mb-1 text-sm font-medium text-muted-foreground">Full Name</dt>
                  <dd className="font-medium text-foreground">{person.first_name} {person.last_name}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-sm font-medium text-muted-foreground">Email</dt>
                  <dd className="text-foreground">{person.email || '—'}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-sm font-medium text-muted-foreground">Phone</dt>
                  <dd className="text-foreground">{person.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-sm font-medium text-muted-foreground">Gender</dt>
                  <dd className="capitalize text-foreground">{person.gender?.replace(/_/g, ' ') || '—'}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-sm font-medium text-muted-foreground">Birthdate</dt>
                  <dd className="text-foreground">{person.birthdate ? format(new Date(person.birthdate), 'MMM d, yyyy') : '—'}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-sm font-medium text-muted-foreground">Marital Status</dt>
                  <dd className="capitalize text-foreground">{person.marital_status || '—'}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-sm font-medium text-muted-foreground">Anniversary</dt>
                  <dd className="text-foreground">{person.anniversary ? format(new Date(person.anniversary), 'MMM d, yyyy') : '—'}</dd>
                </div>
                <div>
                  <dt className="mb-1 text-sm font-medium text-muted-foreground">Campus</dt>
                  <dd className="text-foreground">{person.campus || '—'}</dd>
                </div>
              </dl>
              
              {person.person_field_values && person.person_field_values.length > 0 && (
                <div className="mt-6 border-t border-slate-100 pt-6">
                  <h4 className="mb-4 text-sm font-bold text-slate-900">Custom fields</h4>
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 [&>div]:rounded-2xl [&>div]:border [&>div]:border-slate-100 [&>div]:p-4 [&_dd]:mt-1.5 [&_dd]:font-semibold [&_dd]:text-slate-900 [&_dt]:text-[10px] [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-[0.13em] [&_dt]:text-slate-400">
                    {person.person_field_values.map((fieldValue) => (
                      <div key={fieldValue.id}>
                        <dt className="mb-1 text-sm font-medium text-muted-foreground">{fieldValue.field_definition?.name}</dt>
                        <dd className="text-foreground">{fieldValue.value || '—'}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
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
                        className="border py-1 shadow-none"
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
                  <div className="flex items-center gap-2 font-semibold text-foreground">
                    <Users className="h-4 w-4 text-muted-foreground" /> {person.household.name}
                  </div>
                  <p className="mt-2 text-xs text-slate-500">Household relationship</p>
                </div>
              ) : (
                <div>
                  <span className="mb-3 block text-sm text-muted-foreground">Not part of a household.</span>
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
                      <div className="text-sm font-medium text-foreground">{card.workflows?.name || 'Workflow'} <span className="mx-1 font-normal text-muted-foreground">→</span> {card.workflow_steps?.name || 'Done'}</div>
                      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
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
  );
}
