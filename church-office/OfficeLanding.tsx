// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { requireTenantContext } from '@/lib/tenant-context';
import { canAccessChurchOffice } from './access';

export async function OfficeLanding({ events = false }: { events?: boolean }) {
  const allowed = canAccessChurchOffice(await requireTenantContext());
  return (
    <section className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">{events ? 'Event Calendar' : 'Church Office'}</h1>
      {!allowed ? (
        <p className="mt-4" role="status">
          Access requires the verified Church Office administrator account and the HarvestGen workspace.
        </p>
      ) : (
        <div className="mt-4 rounded-xl border bg-white p-5">
          <p>Live room reservations are pending Booking Room integration.</p>
          {!events && <Link className="mt-4 inline-block underline" href="/church-office/events">Event Calendar</Link>}
          {process.env.NODE_ENV === 'development' && (
            <Link className="mt-4 block underline" href="/preview/church-office/events">Open the fictional calendar preview</Link>
          )}
        </div>
      )}
    </section>
  );
}
