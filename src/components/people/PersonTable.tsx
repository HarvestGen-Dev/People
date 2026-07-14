'use client';

// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowUpRight,
  Mail,
  MoreHorizontal,
  MapPin,
  UserPlus,
} from 'lucide-react';
import type { PeopleDirectoryPerson } from '@/lib/queries/people';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useAdminPermissions } from '@/components/layout/AdminPermissions';

interface PersonTableProps {
  people: PeopleDirectoryPerson[];
}

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  visitor: 'bg-sky-100 text-sky-700 border-sky-200',
  child: 'bg-violet-100 text-violet-700 border-violet-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
};

function PersonTags({ person }: { person: PeopleDirectoryPerson }) {
  const visibleTags = person.person_tags?.filter((item) => item.tag).slice(0, 2);
  const remaining = Math.max(0, (person.person_tags?.length || 0) - 2);

  if (!visibleTags?.length) {
    return <span className="text-xs text-slate-400">No tags</span>;
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {visibleTags.map((personTag) =>
        personTag.tag ? (
          <Badge
            key={personTag.tag.id}
            style={{
              backgroundColor: `${personTag.tag.color}12`,
              color: personTag.tag.color,
              borderColor: `${personTag.tag.color}35`,
            }}
            className="h-6 border px-2 text-[10px] font-bold shadow-none"
            variant="outline"
          >
            {personTag.tag.name}
          </Badge>
        ) : null
      )}
      {remaining > 0 && (
        <Badge
          variant="secondary"
          className="h-6 px-2 text-[10px] font-bold text-slate-500 shadow-none"
        >
          +{remaining}
        </Badge>
      )}
    </div>
  );
}

export function PersonTable({ people }: PersonTableProps) {
  const router = useRouter();
  const { canManage } = useAdminPermissions();

  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-20 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700">
          <UserPlus className="h-6 w-6" />
        </div>
        <h3 className="mt-5 text-xl font-bold text-slate-950">No people found</h3>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">
          Adjust the current filters or add a new member or visitor to the
          directory.
        </p>
        {canManage && (
          <Link href="/people/new" className="mt-6">
            <Button className="h-10 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800">
              Add person
            </Button>
          </Link>
        )}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {people.map((person) => (
          <article
            key={person.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-11 w-11 border border-emerald-200">
                <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-700">
                  {person.first_name[0]}
                  {person.last_name[0]}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/people/${person.id}`}
                  className="font-bold text-slate-950 hover:text-emerald-700"
                >
                  {person.first_name} {person.last_name}
                </Link>
                <div className="mt-1 flex items-center gap-1.5 truncate text-xs text-slate-500">
                  <Mail className="h-3 w-3 shrink-0" />
                  {person.email || 'No email address'}
                </div>
              </div>
              <Badge
                variant="outline"
                className={`capitalize shadow-none ${statusStyles[person.status]}`}
              >
                {person.status}
              </Badge>
            </div>
            <div className="mt-4 flex items-end justify-between gap-3 border-t border-slate-100 pt-3">
              <div className="min-w-0 space-y-2">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" />
                  {person.campus || 'No campus'}
                </div>
                <PersonTags person={person} />
              </div>
              <Link
                href={`/people/${person.id}`}
                aria-label={`View ${person.first_name} ${person.last_name}`}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-slate-200/80 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70">
              <tr className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                <th className="px-6 py-4">Person</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Tags</th>
                <th className="px-5 py-4">Campus</th>
                <th className="px-5 py-4">Added</th>
                <th className="w-16 px-5 py-4">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((person) => (
                <tr
                  key={person.id}
                  className="group transition-colors hover:bg-emerald-50/35"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-emerald-200">
                        <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-700">
                          {person.first_name[0]}
                          {person.last_name[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <Link
                          href={`/people/${person.id}`}
                          className="block truncate font-bold text-slate-900 transition-colors group-hover:text-emerald-700"
                        >
                          {person.first_name} {person.last_name}
                        </Link>
                        <div className="mt-0.5 max-w-[260px] truncate text-xs text-slate-500">
                          {person.email || person.phone || 'No contact details'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <Badge
                      variant="outline"
                      className={`capitalize shadow-none ${statusStyles[person.status]}`}
                    >
                      {person.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-4">
                    <PersonTags person={person} />
                  </td>
                  <td className="px-5 py-4 text-sm font-medium text-slate-600">
                    {person.campus || '—'}
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">
                    {person.created_at
                      ? new Intl.DateTimeFormat('en', {
                          month: 'short',
                          year: 'numeric',
                        }).format(new Date(person.created_at))
                      : '—'}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Actions for ${person.first_name} ${person.last_name}`}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-800"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="w-[170px] rounded-xl"
                      >
                        <DropdownMenuItem
                          onClick={() => router.push(`/people/${person.id}`)}
                        >
                          View profile
                        </DropdownMenuItem>
                        {canManage && (
                          <DropdownMenuItem
                            onClick={() =>
                              router.push(`/people/${person.id}/edit`)
                            }
                          >
                            Edit details
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
