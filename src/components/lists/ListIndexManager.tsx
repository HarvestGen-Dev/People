'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Folder,
  MoreHorizontal,
  Plus,
  Sparkles,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ListWithCount, SmartListFilters } from '@/lib/types';
import { useAdminPermissions } from '@/components/layout/AdminPermissions';
import { displayIdFor } from '@/lib/display-ids';

type ListRow = ListWithCount & { filters: SmartListFilters | null };

export function ListIndexManager({
  initialLists,
}: {
  initialLists: ListRow[];
}) {
  const router = useRouter();
  const { canManage } = useAdminPermissions();
  const [lists, setLists] = useState(initialLists);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'smart' as 'smart' | 'static',
  });

  const smartLists = lists.filter((list) => list.type === 'smart');
  const staticLists = lists.filter((list) => list.type === 'static');

  const openCreate = () => {
    setFormData({ name: '', type: 'smart' });
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    if (!formData.name.trim()) return;
    router.push(
      `/lists/new?type=${formData.type}&name=${encodeURIComponent(formData.name)}`
    );
    setIsDialogOpen(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this list?')) return;
    try {
      const response = await fetch(`/api/admin/lists/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete list');
      setLists((current) => current.filter((list) => list.id !== id));
      toast.success('List deleted');
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete list'
      );
    }
  };

  const renderListGroup = (
    data: ListRow[],
    type: 'smart' | 'static'
  ) => {
    const isSmart = type === 'smart';
    const Icon = isSmart ? Sparkles : Folder;

    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`grid h-10 w-10 place-items-center rounded-xl ${
                isSmart
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-sky-100 text-sky-700'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div>
              <h2 className="font-bold text-slate-950">
                {isSmart ? 'Smart lists' : 'Static lists'}
              </h2>
              <p className="text-xs text-slate-500">
                {isSmart
                  ? 'Live audiences that update automatically'
                  : 'Hand-picked groups for a specific purpose'}
              </p>
            </div>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-slate-500 ring-1 ring-slate-200">
            {data.length}
          </span>
        </div>

        {data.length === 0 ? (
          <div className="flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/60 px-6 py-12 text-center">
            <Icon className="h-7 w-7 text-slate-300" />
            <span className="mt-3 text-sm font-bold text-slate-700">
              No {type} lists yet
            </span>
            <span className="mt-1 text-xs text-slate-400">
              {canManage
                ? 'Create one to organize your people.'
                : 'No lists are available yet.'}
            </span>
            {canManage && (
              <Button
                type="button"
                variant="outline"
                onClick={openCreate}
                className="mt-5 rounded-xl"
              >
                Create {type} list
              </Button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.map((list) => {
              const ruleCount = list.filters?.rules?.length || 0;
              const listDisplayId = displayIdFor(list);
              return (
                <article
                  key={list.id}
                  className="group rounded-3xl border border-slate-200/80 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_20px_45px_-35px_rgba(6,78,59,0.45)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={`grid h-11 w-11 place-items-center rounded-2xl ${
                        isSmart
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-sky-100 text-sky-700'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    {canManage && <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={`Actions for ${list.name}`}
                        className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-800"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-36 rounded-xl">
                        <DropdownMenuItem
                          onClick={() => router.push(`/lists/${listDisplayId}`)}
                        >
                          Open list
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(list.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>}
                  </div>

                  <button
                    type="button"
                    onClick={() => router.push(`/lists/${listDisplayId}`)}
                    className="mt-5 block w-full text-left"
                  >
                    <h3 className="truncate text-lg font-bold text-slate-950 group-hover:text-emerald-700">
                      {list.name}
                    </h3>
                    <p className="mt-2 min-h-10 text-sm leading-5 text-slate-500">
                      {isSmart
                        ? `${ruleCount} ${ruleCount === 1 ? 'rule' : 'rules'} · Match ${list.filters?.operator || 'ALL'}`
                        : `${list.member_count || 0} ${(list.member_count || 0) === 1 ? 'person' : 'people'} selected`}
                    </p>
                  </button>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <span className="text-[11px] font-medium text-slate-400">
                      Created{' '}
                      {formatDistanceToNow(new Date(list.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-10">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Audiences
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950 sm:text-4xl">
            Lists
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Build live segments from your data or curate a fixed group of
            people for a ministry need.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openCreate}
            className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800"
          >
            <Plus className="mr-2 h-4 w-4" />
            New list
          </Button>
        )}
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ['Total lists', lists.length, Users],
          ['Smart', smartLists.length, Sparkles],
          ['Static', staticLists.length, Folder],
        ].map(([label, value, StatIcon]) => {
          const Icon = StatIcon as typeof Users;
          return (
            <div
              key={String(label)}
              className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700">
                <Icon className="h-[18px] w-[18px]" />
              </div>
              <div>
                <div className="text-2xl font-bold text-slate-950">
                  {String(value)}
                </div>
                <div className="text-xs font-medium text-slate-500">
                  {String(label)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {renderListGroup(smartLists, 'smart')}
      {renderListGroup(staticLists, 'static')}

      {canManage && <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="rounded-3xl sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold tracking-tight">
              Create a list
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                List name
              </label>
              <Input
                value={formData.name}
                onChange={(event) =>
                  setFormData({ ...formData, name: event.target.value })
                }
                placeholder="e.g. Active Volunteers"
                className="h-11 rounded-xl"
                autoFocus
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  type: 'smart' as const,
                  icon: Sparkles,
                  title: 'Smart list',
                  description: 'Updates automatically from matching rules.',
                },
                {
                  type: 'static' as const,
                  icon: Folder,
                  title: 'Static list',
                  description: 'A group you select and manage manually.',
                },
              ].map((option) => (
                <label
                  key={option.type}
                  className={`cursor-pointer rounded-2xl border p-4 transition-colors ${
                    formData.type === option.type
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    checked={formData.type === option.type}
                    onChange={() =>
                      setFormData({ ...formData, type: option.type })
                    }
                    className="sr-only"
                  />
                  <option.icon className="h-5 w-5 text-emerald-700" />
                  <div className="mt-4 text-sm font-bold text-slate-900">
                    {option.title}
                  </div>
                  <div className="mt-1 text-xs leading-5 text-slate-500">
                    {option.description}
                  </div>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name.trim()}
              className="rounded-xl bg-emerald-700 font-bold hover:bg-emerald-800"
            >
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>}
    </div>
  );
}
