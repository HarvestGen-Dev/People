// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import type { PersonWithRelations } from '@/lib/types';
import { displayIdFor } from '@/lib/display-ids';
import { formatAddedDate, PersonAvatar, PersonStatus } from './PersonIdentity';
import { PreviewDialog } from './PreviewDialog';

export function ProfilePreview({ person, canManage, closeHref }: {
  person: PersonWithRelations; canManage: boolean; closeHref: string;
}) {
  const id = displayIdFor(person);
  const path = `/people/${id}`;
  const tags = (person.person_tags ?? []).flatMap(({ tag }) => tag ? [tag.name] : []);
  return (
    <PreviewDialog closeHref={closeHref} triggerId={`preview-${id}`}>
      <div className="p-5 sm:p-6">
        <PersonAvatar person={person} large />
        <h2 id="person-preview-title" className="mt-4 text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">{person.first_name} {person.last_name}</h2>
        <div className="mt-2"><PersonStatus status={person.status} /></div>
        <div className="workspace-actions my-5">
          <Link href={path} className="workspace-button" data-primary>View full profile</Link>
          {canManage && <Link href={`${path}/edit`} className="workspace-button">Edit profile</Link>}
        </div>
        <dl className="directory-profile-details">
          <div><dt>Email</dt><dd>{person.email ? <a href={`mailto:${person.email}`}>{person.email}</a> : '—'}</dd></div>
          <div><dt>Phone</dt><dd>{person.phone ? <a href={`tel:${person.phone}`}>{person.phone}</a> : '—'}</dd></div>
          <div><dt>Campus</dt><dd>{person.campus || '—'}</dd></div>
          <div><dt>Tags</dt><dd>{tags.join(', ') || '—'}</dd></div>
          <div><dt>Added</dt><dd>{formatAddedDate(person.created_at)}</dd></div>
        </dl>
      </div>
    </PreviewDialog>
  );
}
