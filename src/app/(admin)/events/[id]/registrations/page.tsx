// <!-- AGENT: BACKEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { Topbar } from '@/components/layout/Topbar';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { RegistrationsTable } from '@/components/events/RegistrationsTable';
import { requireTenantContext } from '@/lib/tenant-context';
import { getRegistrations } from '@/lib/queries/registrations';
import { Pagination } from '@/components/ui/pagination';

export const metadata = {
  title: 'Registrations | HarvestGen',
};

export default async function EventRegistrationsPage({ 
  params,
  searchParams,
}: { 
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const supabase = createServiceClient();
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id, name, price')
    .eq('id', id)
    .eq('church_id', churchId)
    .single();

  if (eventError || !event) {
    notFound();
  }

  const page = typeof resolvedSearchParams.page === 'string' ? parseInt(resolvedSearchParams.page, 10) : 1;
  const status = typeof resolvedSearchParams.status === 'string' ? resolvedSearchParams.status : 'all';
  const pageSize = 50;

  const { registrations, total, statusCounts } = await getRegistrations({
    church_id: churchId,
    event_id: id,
    page,
    pageSize,
    status,
  });

  return (
    <>
      <Topbar title={`${event.name} — Registrations`}>
        <Link href="/events">
          <Button variant="ghost" className="rounded-xl shadow-none h-9 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
          </Button>
        </Link>
      </Topbar>

      <div className="mx-auto max-w-[1440px] p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10 space-y-6">
        <RegistrationsTable 
          registrations={registrations}
          isFreeEvent={event.price === 0}
          serverStatusCounts={statusCounts}
          currentFilter={status}
        />

        {total > pageSize && (
          <Pagination total={total} pageSize={pageSize} />
        )}
      </div>
    </>
  );
}
// <!-- AGENT: BACKEND -->
