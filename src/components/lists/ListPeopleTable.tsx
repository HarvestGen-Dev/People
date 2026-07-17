'use client';

// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import { Mail, Phone, Trash2, Users } from 'lucide-react';
import type { ListPerson } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { displayIdFor } from '@/lib/display-ids';

const statusStyles: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  visitor: 'bg-sky-100 text-sky-700 border-sky-200',
  child: 'bg-violet-100 text-violet-700 border-violet-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
};

export function ListPeopleTable({
  people,
  emptyMessage,
  onRemove,
}: {
  people: ListPerson[];
  emptyMessage: string;
  onRemove?: (personId: string) => void;
}) {
  if (people.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
        <Users className="mx-auto h-8 w-8 text-slate-300" />
        <p className="mt-4 text-sm font-semibold text-slate-600">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 md:hidden">
        {people.map((person) => {
          const personDisplayId = displayIdFor(person);

          return (
          <article
            key={person.id}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 border border-emerald-200">
                {person.photo_signed_url ? (
                  <img
                    src={person.photo_signed_url}
                    alt={`${person.first_name} ${person.last_name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AvatarFallback className="bg-emerald-100 text-xs font-bold text-emerald-700">
                    {person.first_name[0]}
                    {person.last_name[0]}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/people/${personDisplayId}`}
                  className="font-bold text-slate-900 hover:text-emerald-700"
                >
                  {person.first_name} {person.last_name}
                </Link>
                <div className="mt-1 truncate text-xs text-slate-500">
                  {person.email || person.phone || 'No contact details'}
                </div>
              </div>
              <Badge
                variant="outline"
                className={`capitalize shadow-none ${statusStyles[person.status]}`}
              >
                {person.status}
              </Badge>
            </div>
            {onRemove && (
              <div className="mt-3 flex justify-end border-t border-slate-100 pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRemove(person.id)}
                  className="rounded-xl text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            )}
          </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-3xl border border-slate-200/80 bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50/70">
              <tr className="text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">
                <th className="px-6 py-4">Person</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Contact</th>
                <th className="px-5 py-4">Campus</th>
                {onRemove && <th className="w-20 px-5 py-4" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((person) => {
                const personDisplayId = displayIdFor(person);

                return (
                <tr
                  key={person.id}
                  className="group transition-colors hover:bg-emerald-50/35"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-emerald-200">
                        {person.photo_signed_url ? (
                          <img
                            src={person.photo_signed_url}
                            alt={`${person.first_name} ${person.last_name}`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <AvatarFallback className="bg-emerald-100 text-[10px] font-bold text-emerald-700">
                            {person.first_name[0]}
                            {person.last_name[0]}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <Link
                        href={`/people/${personDisplayId}`}
                        className="font-bold text-slate-900 hover:text-emerald-700"
                      >
                        {person.first_name} {person.last_name}
                      </Link>
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
                    <div className="space-y-1 text-xs text-slate-500">
                      {person.email && (
                        <div className="flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          {person.email}
                        </div>
                      )}
                      {person.phone && (
                        <div className="flex items-center gap-1.5">
                          <Phone className="h-3 w-3" />
                          {person.phone}
                        </div>
                      )}
                      {!person.email && !person.phone && '—'}
                    </div>
                  </td>
                  <td className="px-5 py-4 font-medium text-slate-600">
                    {person.campus || '—'}
                  </td>
                  {onRemove && (
                    <td className="px-5 py-4 text-right">
                      <Button
                        aria-label={`Remove ${person.first_name} ${person.last_name}`}
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(person.id)}
                        className="rounded-xl text-slate-400 opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100 focus:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  )}
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
