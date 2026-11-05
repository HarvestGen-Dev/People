// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import type { PersonWithRelations } from '@/lib/types';
import { displayIdFor } from '@/lib/display-ids';
import { EmptyState } from '@/components/workspace/Workspace';
import { formatAddedDate, PersonAvatar, PersonStatus } from './PersonIdentity';

export function PersonTable({ people, hrefForPreview }: {
  people: PersonWithRelations[]; hrefForPreview: (id: string) => string;
}) {
  if (!people.length) {
    return <EmptyState title="No people found" description="Try a different search or clear your filters." />;
  }

  return (
    <table className="directory-table" aria-label="People">
      <thead>
        <tr>
          <th scope="col">Person</th>
          <th scope="col">Status</th>
          <th scope="col" className="directory-extra">Tags</th>
          <th scope="col" className="directory-extra">Campus</th>
          <th scope="col" className="directory-extra">Added</th>
        </tr>
      </thead>
      <tbody>
        {people.map((person) => {
          const id = displayIdFor(person);
          const tags = (person.person_tags ?? []).flatMap(({ tag }) => tag ? [tag] : []);
          return (
            <tr key={id}>
              <td>
                <Link className="directory-person" id={`preview-${id}`} href={hrefForPreview(id)} prefetch={false} scroll={false} aria-haspopup="dialog">
                  <PersonAvatar person={person} />
                  <span className="min-w-0">
                    <strong>{person.first_name} {person.last_name}</strong>
                    <span className="directory-contact">{person.email || person.phone || 'No contact details'}</span>
                  </span>
                  <ChevronRight size={16} aria-hidden="true" className="ms-auto shrink-0 text-muted-foreground" />
                </Link>
              </td>
              <td><PersonStatus status={person.status} /></td>
              <td className="directory-extra">
                {tags.length ? <div className="flex flex-wrap gap-1">
                  {tags.slice(0, 2).map((tag) => <span className="directory-tag" key={tag.id}>{tag.name}</span>)}
                  {tags.length > 2 && <span className="directory-tag" aria-label={`${tags.length - 2} more tags`}>+{tags.length - 2}</span>}
                </div> : '—'}
              </td>
              <td className="directory-extra">{person.campus || '—'}</td>
              <td className="directory-extra">{formatAddedDate(person.created_at)}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
