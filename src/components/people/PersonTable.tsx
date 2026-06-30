'use client';

import { PersonWithRelations } from '@/lib/types';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { MoreHorizontal, UserPlus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface PersonTableProps {
  people: PersonWithRelations[];
}

export function PersonTable({ people }: PersonTableProps) {
  const router = useRouter();

  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border rounded-2xl bg-card/50">
        <div className="h-16 w-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mb-4">
          <UserPlus className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-semibold text-foreground">No people found</h3>
        <p className="text-muted-foreground mt-2 mb-6 max-w-sm">
          Get started by adding your first church member or adjust your search filters.
        </p>
        <Link href="/people/new">
          <Button className="rounded-xl h-11 px-6 shadow-sm">Add your first member</Button>
        </Link>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-transparent';
      case 'visitor': return 'bg-blue-100 text-blue-700 hover:bg-blue-100/80 border-transparent';
      case 'child': return 'bg-purple-100 text-purple-700 hover:bg-purple-100/80 border-transparent';
      case 'inactive': return 'bg-slate-100 text-slate-700 hover:bg-slate-100/80 border-transparent';
      default: return 'bg-slate-100 text-slate-700 border-transparent';
    }
  };

  return (
    <div className="bg-card border border-border shadow-sm rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground font-medium border-b border-border">
            <tr>
              <th className="px-6 py-4 rounded-tl-2xl">Name</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Tags</th>
              <th className="px-6 py-4">Campus</th>
              <th className="px-6 py-4">Member since</th>
              <th className="px-6 py-4 text-right rounded-tr-2xl">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.map((person) => (
              <tr 
                key={person.id} 
                className="hover:bg-muted/30 transition-colors group cursor-pointer"
                onClick={(e) => {
                  // Don't navigate if clicking the dropdown button
                  if ((e.target as HTMLElement).closest('button')) return;
                  router.push(`/people/${person.id}`);
                }}
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 bg-primary/10 text-primary border border-primary/20">
                      <AvatarFallback className="font-semibold bg-primary/10 text-primary">
                        {person.first_name[0]}{person.last_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-semibold text-foreground text-base group-hover:text-primary transition-colors">
                        {person.first_name} {person.last_name}
                      </div>
                      <div className="text-muted-foreground text-xs mt-0.5">{person.email || 'No email'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <Badge className={`capitalize shadow-none font-medium ${getStatusColor(person.status)}`}>
                    {person.status}
                  </Badge>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {person.person_tags?.slice(0, 3).map((pt: any) => (
                      <Badge 
                        key={pt.tag.id} 
                        style={{ backgroundColor: pt.tag.color + '20', color: pt.tag.color, borderColor: pt.tag.color + '40' }}
                        className="shadow-none border text-xs py-0 h-5"
                        variant="outline"
                      >
                        {pt.tag.name}
                      </Badge>
                    ))}
                    {person.person_tags && person.person_tags.length > 3 && (
                      <Badge variant="secondary" className="shadow-none text-xs py-0 h-5 text-muted-foreground">
                        +{person.person_tags.length - 3} more
                      </Badge>
                    )}
                    {(!person.person_tags || person.person_tags.length === 0) && (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-foreground/80">
                  {person.campus || '—'}
                </td>
                <td className="px-6 py-4 text-foreground/80">
                  {person.created_at ? new Intl.DateTimeFormat('en-US', { month: 'short', year: 'numeric' }).format(new Date(person.created_at)) : '—'}
                </td>
                <td className="px-6 py-4 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex h-8 w-8 p-0 items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[160px] rounded-xl shadow-lg border-border">
                      <DropdownMenuItem onClick={() => router.push(`/people/${person.id}`)} className="cursor-pointer">
                        View profile
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => router.push(`/people/${person.id}/edit`)} className="cursor-pointer">
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:bg-destructive/10 cursor-pointer">
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
