// <!-- AGENT: FRONTEND -->
import { Search } from 'lucide-react';
import type { Tag } from '@/lib/types';
import { DirectoryForm } from './DirectoryForm';

export const statuses = ['active', 'visitor', 'inactive', 'child'] as const;

export function PeopleFilters({ tags, search, status, tag }: {
  tags: Pick<Tag, 'id' | 'name'>[];
  search?: string;
  status?: string;
  tag?: string;
}) {
  return (
    <DirectoryForm>
      <label className="directory-search">
        <span className="sr-only">Search people</span>
        <Search size={18} aria-hidden="true" />
        <input name="search" type="search" defaultValue={search} placeholder="Search name, email, or phone" />
      </label>
      <label className="min-w-0">
        <span className="sr-only">Filter by status</span>
        <select key={status} name="status" defaultValue={status ?? ''}>
          <option value="">All statuses</option>
          {statuses.map((value) => <option key={value} value={value}>{value[0].toUpperCase() + value.slice(1)}</option>)}
        </select>
      </label>
      <label className="min-w-0">
        <span className="sr-only">Filter by tag</span>
        <select key={tag} name="tag" defaultValue={tag ?? ''}>
          <option value="">All tags</option>
          {tags.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
        </select>
      </label>
      <div className="directory-filter-actions">
        <button className="workspace-button" type="submit">Search</button>
        {(search || status || tag) && <a className="workspace-link" href="/people">Clear filters</a>}
      </div>
    </DirectoryForm>
  );
}
