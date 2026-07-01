'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Edit2 } from 'lucide-react';
import { SmartListBuilder } from './SmartListBuilder';
import { ListPeopleTable } from './ListPeopleTable';
import type {
  List,
  ListPerson,
  ListTag,
  SmartListFilters,
} from '@/lib/types';

type SmartListRecord = Omit<List, 'filters'> & {
  filters: SmartListFilters | null;
};

export function SmartListDetail({
  list,
  people,
  tags,
}: {
  list: SmartListRecord;
  people: ListPerson[];
  tags: ListTag[];
}) {
  const [isEditing, setIsEditing] = useState(false);

  const handleExport = () => {
    window.open(`/api/admin/lists/${list.id}/export`, '_blank');
  };

  if (isEditing) {
    return (
      <div className="space-y-5">
        <Button variant="ghost" onClick={() => setIsEditing(false)} className="rounded-xl">← Back to list</Button>
        <SmartListBuilder listId={list.id} initialName={list.name} initialFilters={list.filters} tags={tags} />
      </div>
    );
  }

  const renderRulesSummary = () => {
    if (!list.filters || !list.filters.rules) return 'No rules defined.';
    const opsMap: Record<string, string> = {
      is: 'is', is_not: 'is not', includes: 'includes', excludes: 'excludes',
      contains: 'contains', within_last_days: 'within last N days',
      is_before: 'is before', is_after: 'is after'
    };
    
    return (
      <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="mb-4 text-sm font-semibold text-slate-700">
          People match <strong className="rounded-md bg-emerald-100 px-2 py-1 text-emerald-800">{list.filters.operator}</strong> of the following rules
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {list.filters.rules.map((rule, i) => {
            if (rule.field === 'has_no_email') return <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700">Has no email address</li>;
            let displayVal = rule.value ?? '';
            if (rule.field === 'tag') {
              displayVal = tags.find(t => t.id === rule.value)?.name || 'Unknown Tag';
            }
            return (
              <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm capitalize text-slate-600">
                <strong>{rule.field.replace('_', ' ')}</strong> {opsMap[rule.op] || rule.op} <strong>{displayVal}</strong>
              </li>
            );
          })}
        </ul>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Smart list</div>
          <h2 className="mt-2 text-3xl font-bold tracking-[-0.03em] text-slate-950">{list.name}</h2>
          <p className="mt-2 text-sm text-slate-500">{people.length} matching people · updates automatically</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl bg-white shadow-sm gap-2">
            <Edit2 className="h-4 w-4" /> Edit rules
          </Button>
          <Button onClick={handleExport} className="rounded-xl bg-emerald-700 font-bold shadow-sm hover:bg-emerald-800 gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {renderRulesSummary()}

      <ListPeopleTable people={people} emptyMessage="No people currently match these rules." />
    </div>
  );
}
