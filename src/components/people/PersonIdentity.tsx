// <!-- AGENT: FRONTEND -->
import type { Person } from '@/lib/types';

export function PersonAvatar({ person, large = false }: {
  person: Pick<Person, 'first_name' | 'last_name' | 'photo_signed_url'>; large?: boolean;
}) {
  return (
    <span aria-hidden="true" className={`directory-avatar${large ? ' directory-avatar-large' : ''}`}>
      {person.photo_signed_url ? (
        // Signed private URLs should go directly to the browser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={person.photo_signed_url} alt="" width={large ? 64 : 36} height={large ? 64 : 36} loading={large ? 'eager' : 'lazy'} />
      ) : `${person.first_name[0] ?? ''}${person.last_name[0] ?? ''}`.toUpperCase()}
    </span>
  );
}

export function PersonStatus({ status }: { status: Person['status'] }) {
  return <span className="directory-status" data-status={status}>{status}</span>;
}

export function formatAddedDate(date: string | null) {
  return date ? new Intl.DateTimeFormat('en-MY', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(date)) : '—';
}
