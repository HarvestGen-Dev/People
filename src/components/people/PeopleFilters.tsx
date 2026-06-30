'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tag } from '@/lib/types';
import Link from 'next/link';

interface PeopleFiltersProps {
  tags: Tag[];
  total: number;
}

export function PeopleFilters({ tags, total }: PeopleFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();

  const [search, setSearch] = useState(searchParams.get('search') || '');

  const updateFilters = useCallback((key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete('page'); // Reset page when filters change
    router.replace(`${pathname}?${params.toString()}`);
  }, [searchParams, pathname, router]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (search !== (searchParams.get('search') || '')) {
        updateFilters('search', search);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, searchParams, updateFilters]);

  const hasFilters = searchParams.has('search') || searchParams.has('status') || searchParams.has('tag');

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 py-4 mb-4">
      <div className="flex flex-1 items-center gap-3 w-full sm:w-auto">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 rounded-xl shadow-sm bg-card border-border h-10 w-full"
          />
        </div>

        <Select 
          value={searchParams.get('status') || 'all'} 
          onValueChange={(val) => updateFilters('status', val)}
        >
          <SelectTrigger className="w-[140px] rounded-xl shadow-sm bg-card h-10 border-border">
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
          onValueChange={(val) => updateFilters('tag', val)}
        >
          <SelectTrigger className="w-[140px] rounded-xl shadow-sm bg-card h-10 border-border truncate">
            <SelectValue placeholder="Tag" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All tags</SelectItem>
            {tags.map(tag => (
              <SelectItem key={tag.id} value={tag.id}>{tag.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Link href={pathname} className="text-sm font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors ml-2">
            <X className="h-4 w-4" /> Clear
          </Link>
        )}
      </div>

      <div className="text-sm font-medium text-muted-foreground">
        {total} {total === 1 ? 'person' : 'people'}
      </div>
    </div>
  );
}
