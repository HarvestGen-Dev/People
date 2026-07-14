'use client';

// <!-- AGENT: FRONTEND -->
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Tag } from '@/lib/types';

interface PeopleFiltersProps {
  tags: Tag[];
  total: number;
}

export function PeopleFilters({ tags, total }: PeopleFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const updateFilters = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value && value !== 'all') {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      params.delete('page');
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname);
    },
    [searchParams, pathname, router]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get('search') || '')) {
        updateFilters('search', search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchParams, updateFilters]);

  const hasFilters =
    searchParams.has('search') ||
    searchParams.has('status') ||
    searchParams.has('tag') ||
    searchParams.has('quality');

  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-[0_10px_35px_-32px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            aria-label="Search people"
            placeholder="Search name, email, or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-11 rounded-xl border-transparent bg-slate-50 pl-10 shadow-none focus-visible:border-emerald-300 focus-visible:bg-white"
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="hidden items-center gap-2 px-2 text-xs font-bold uppercase tracking-[0.13em] text-slate-400 xl:flex">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </div>
          <Select
            value={searchParams.get('status') || 'all'}
            onValueChange={(value) => updateFilters('status', value)}
          >
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white shadow-none sm:w-[165px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="visitor">Visitor</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="child">Child</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={searchParams.get('tag') || 'all'}
            onValueChange={(value) => updateFilters('tag', value)}
          >
            <SelectTrigger className="h-11 w-full rounded-xl border-slate-200 bg-white shadow-none sm:w-[165px]">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  {tag.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Link
              href={pathname}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
            >
              <X className="h-4 w-4" />
              Clear
            </Link>
          )}
        </div>

        <div className="border-t border-slate-100 px-2 pt-3 text-sm font-semibold text-slate-500 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <span className="text-slate-950">{total.toLocaleString()}</span>{' '}
          {total === 1 ? 'person' : 'people'}
        </div>
      </div>
    </section>
  );
}
