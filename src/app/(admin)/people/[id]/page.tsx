import { getPersonById, getPersonNotes, getPersonEvents, getPersonWorkflowCards } from '@/lib/queries/person';
import { notFound } from 'next/navigation';
import { PersonProfile } from '@/components/people/PersonProfile';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Cake, Mail, MapPin, Pencil, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { requireTenantContext } from '@/lib/tenant-context';
import { redirect } from 'next/navigation';
import { applyDisplayOrDatabaseIdFilter, displayIdFor } from '@/lib/display-ids';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { churchId } = await requireTenantContext();
  const supabase = await createClient();
  const query = supabase
    .from('people')
    .select('first_name, last_name')
    .eq('church_id', churchId);
  const { data } = await applyDisplayOrDatabaseIdFilter(query, id).single();
  return { title: data ? `${data.first_name} ${data.last_name} | People` : 'Person Not Found' };
}

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { churchId, role, isPlatformAdmin } = await requireTenantContext();

  if (role === 'workflow_manager') {
    redirect('/workflows');
  }

  const canManage =
    isPlatformAdmin || role === 'owner' || role === 'admin';

  const [person, notes, events, workflowCards] = await Promise.all([
    getPersonById(id, churchId),
    getPersonNotes(id, churchId),
    getPersonEvents(id, churchId),
    getPersonWorkflowCards(id, churchId)
  ]);

  if (!person) notFound();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-transparent';
      case 'visitor': return 'bg-blue-100 text-blue-700 border-transparent';
      case 'child': return 'bg-purple-100 text-purple-700 border-transparent';
      case 'inactive': return 'bg-slate-100 text-slate-700 border-transparent';
      default: return 'bg-slate-100 text-slate-700 border-transparent';
    }
  };

  return (
    <>
      <Topbar title="Person profile">
        <div className="flex items-center gap-2">
          {canManage && (
            <Link href={`/people/${displayIdFor(person)}/edit`}>
              <Button variant="outline" className="h-9 rounded-xl border-slate-200 bg-white font-semibold shadow-sm">
                <Pencil className="mr-2 h-3.5 w-3.5" />
                Edit person
              </Button>
            </Link>
          )}
        </div>
      </Topbar>

      <div className="border-b border-slate-200/80 bg-white">
        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10">
          <Link
            href="/people"
            className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-slate-500 transition-colors hover:text-emerald-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to directory
          </Link>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="grid h-20 w-20 shrink-0 place-items-center rounded-3xl bg-emerald-950 text-2xl font-bold text-white shadow-lg shadow-emerald-950/15">
              {person.first_name[0]}
              {person.last_name[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold tracking-[-0.035em] text-slate-950">
                {person.first_name} {person.last_name}
              </h1>
              <Badge className={`capitalize shadow-none font-medium px-2.5 py-0.5 ${getStatusColor(person.status)}`}>
                {person.status}
              </Badge>
              {person.person_tags?.map((personTag) =>
                personTag.tag ? (
                  <Badge key={personTag.tag.id} style={{ backgroundColor: personTag.tag.color + '20', color: personTag.tag.color, borderColor: personTag.tag.color + '40' }} className="border shadow-none py-0.5" variant="outline">
                    {personTag.tag.name}
                  </Badge>
                ) : null
              )}
            </div>
            
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-slate-500">
              {person.email && <span className="flex items-center gap-1.5"><Mail className="h-4 w-4 text-emerald-600" /> {person.email}</span>}
              {person.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-emerald-600" /> {person.phone}</span>}
              {person.campus && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-emerald-600" /> {person.campus}</span>}
              {person.birthdate && <span className="flex items-center gap-1.5"><Cake className="h-4 w-4 text-emerald-600" /> Born {format(new Date(person.birthdate), 'd MMM yyyy')}</span>}
            </div>
            <div className="mt-3 text-xs text-slate-400">
              Member since {person.created_at ? format(new Date(person.created_at), 'MMM yyyy') : '—'}
            </div>
          </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-5 pb-10 sm:px-8 lg:px-10">
        <PersonProfile 
          person={person}
          notes={notes} 
          events={events} 
          workflowCards={workflowCards} 
        />
      </div>
    </>
  );
}
