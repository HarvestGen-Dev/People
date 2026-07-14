// <!-- AGENT: FRONTEND -->
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  GitCompareArrows,
  Mail,
  Phone,
  SearchCheck,
  UsersRound,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { requireTenantContext } from '@/lib/tenant-context';
import { getDuplicatePeopleGroups } from '@/lib/queries/duplicate-people';

export const metadata = {
  title: 'Duplicate Review | People',
};

const reasonLabels = {
  shared_phone: 'Shared phone',
  same_name: 'Same name',
};

const confidenceStyles = {
  high: 'border-red-200 bg-red-50 text-red-700',
  medium: 'border-amber-200 bg-amber-50 text-amber-700',
};

export default async function DuplicatePeoplePage() {
  const { churchId } = await requireTenantContext({ requireManager: true });
  const groups = await getDuplicatePeopleGroups(churchId);
  const candidateCount = groups.reduce(
    (total, group) => total + group.people.length,
    0
  );

  return (
    <div className="mx-auto max-w-[1440px] space-y-6 p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Data stewardship
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Duplicate review
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Review likely duplicate profiles before merging records or changing ministry history.
          </p>
        </div>
        <Link href="/people">
          <Button variant="outline" className="h-11 rounded-xl px-5 font-bold">
            Back to people
          </Button>
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            label: 'Review groups',
            value: groups.length,
            detail: 'Potential duplicate sets',
            icon: GitCompareArrows,
          },
          {
            label: 'Candidate profiles',
            value: candidateCount,
            detail: 'People needing review',
            icon: UsersRound,
          },
          {
            label: 'High confidence',
            value: groups.filter((group) => group.confidence === 'high').length,
            detail: 'Shared normalized phone',
            icon: AlertTriangle,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200/80 bg-white p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-bold tracking-tight text-slate-950">
                  {item.value.toLocaleString()}
                </p>
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <item.icon className="h-[18px] w-[18px]" />
              </div>
            </div>
            <p className="mt-5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-300">
              {item.detail}
            </p>
          </div>
        ))}
      </section>

      {!groups.length ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-20 text-center">
          <SearchCheck className="mx-auto h-10 w-10 text-emerald-600" />
          <h2 className="mt-5 text-xl font-bold text-slate-950">
            No duplicate candidates found
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            People did not find repeated normalized phone numbers or exact repeated names in this workspace.
          </p>
        </section>
      ) : (
        <section className="space-y-4">
          {groups.map((group) => (
            <article
              key={`${group.reason}-${group.key}`}
              className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white"
            >
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-start sm:px-6">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold text-slate-950">
                      {reasonLabels[group.reason]}
                    </h2>
                    <Badge
                      variant="outline"
                      className={`capitalize shadow-none ${confidenceStyles[group.confidence]}`}
                    >
                      {group.confidence} confidence
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {group.label} · {group.people.length} matching profiles
                  </p>
                </div>
                <div className="text-xs font-semibold text-slate-400">
                  Review before changing records
                </div>
              </div>

              <div className="divide-y divide-slate-100">
                {group.people.map((person) => (
                  <div
                    key={person.display_id}
                    className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-center sm:px-6"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/people/${person.display_id}`}
                        className="block truncate text-sm font-bold text-slate-950 hover:text-emerald-700"
                      >
                        {person.first_name} {person.last_name}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <code className="rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                          {person.display_id}
                        </code>
                        <Badge
                          variant="outline"
                          className="capitalize shadow-none"
                        >
                          {person.status}
                        </Badge>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1.5 text-xs text-slate-500">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {person.email || 'No email'}
                        </span>
                      </div>
                      <div className="flex min-w-0 items-center gap-1.5">
                        <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                        <span className="truncate">
                          {person.phone || 'No phone'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {person.campus || 'No campus'} · Updated{' '}
                        {formatDistanceToNow(
                          new Date(person.updated_at || person.created_at),
                          { addSuffix: true }
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/people/${person.display_id}`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-bold text-slate-600 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                    >
                      Open
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
