import { getPersonById, getPersonNotes, getPersonEvents, getPersonWorkflowCards } from '@/lib/queries/person';
import { notFound } from 'next/navigation';
import { PersonProfile } from '@/components/people/PersonProfile';
import { Badge } from '@/components/ui/badge';
import { User, MapPin, Cake, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('people').select('first_name, last_name').eq('id', id).single();
  return { title: data ? `${data.first_name} ${data.last_name} | People` : 'Person Not Found' };
}

export default async function PersonProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  
  // Verify auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const person = await getPersonById(id);
  if (!person) notFound();

  const [notes, events, workflowCards] = await Promise.all([
    getPersonNotes(person.id),
    getPersonEvents(person.id),
    getPersonWorkflowCards(person.id)
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 border-transparent';
      case 'visitor': return 'bg-blue-100 text-blue-700 border-transparent';
      case 'child': return 'bg-purple-100 text-purple-700 border-transparent';
      case 'inactive': return 'bg-slate-100 text-slate-700 border-transparent';
      default: return 'bg-slate-100 text-slate-700 border-transparent';
    }
  };

  const getAge = (birthdate: string) => {
    const ageDifMs = Date.now() - new Date(birthdate).getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  return (
    <>
      <Topbar title={`${person.first_name} ${person.last_name}`}>
        <div className="flex items-center gap-2">
          <Link href={`/people/${person.id}/edit`}>
            <Button variant="outline" className="rounded-xl shadow-sm h-9">Edit</Button>
          </Link>
        </div>
      </Topbar>

      {/* Profile Header - Sticky */}
      <div className="sticky top-0 z-10 bg-white border-b border-border shadow-sm px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-start gap-6">
          <div className="h-20 w-20 shrink-0 rounded-full bg-gradient-to-br from-primary/80 to-primary text-white flex items-center justify-center font-bold text-2xl shadow-md border-2 border-white ring-2 ring-primary/20">
            {person.first_name[0]}{person.last_name[0]}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground tracking-tight">{person.first_name} {person.last_name}</h1>
              <Badge className={`capitalize shadow-none font-medium px-2.5 py-0.5 ${getStatusColor(person.status)}`}>
                {person.status}
              </Badge>
              {person.person_tags?.map((pt: any) => (
                <Badge key={pt.tag.id} style={{ backgroundColor: pt.tag.color + '20', color: pt.tag.color, borderColor: pt.tag.color + '40' }} className="border shadow-none py-0.5" variant="outline">
                  {pt.tag.name}
                </Badge>
              ))}
            </div>
            
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3 text-sm text-muted-foreground font-medium">
              {person.email && <span className="flex items-center gap-1.5"><User className="h-4 w-4 text-primary/70" /> {person.email}</span>}
              {person.phone && <span className="flex items-center gap-1.5"><Phone className="h-4 w-4 text-primary/70" /> {person.phone}</span>}
              {person.campus && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary/70" /> {person.campus}</span>}
              {person.birthdate && <span className="flex items-center gap-1.5"><Cake className="h-4 w-4 text-primary/70" /> Age {getAge(person.birthdate)}</span>}
            </div>
            <div className="text-xs text-muted-foreground mt-3">
              Member since {person.created_at ? format(new Date(person.created_at), 'MMM yyyy') : '—'}
            </div>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto pt-0">
        <PersonProfile 
          person={person as any} 
          notes={notes} 
          events={events} 
          workflowCards={workflowCards} 
        />
      </div>
    </>
  );
}
