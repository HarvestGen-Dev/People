'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Edit2 } from 'lucide-react';
import { SmartListBuilder } from './SmartListBuilder';

export function SmartListDetail({ list, people, tags }: { list: any, people: any[], tags: any[] }) {
  const [isEditing, setIsEditing] = useState(false);

  const handleExport = () => {
    window.open(`/api/admin/lists/${list.id}/export`, '_blank');
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setIsEditing(false)} className="mb-2">← Cancel editing</Button>
        <SmartListBuilder listId={list.id} initialName={list.name} initialFilters={list.filters} tags={tags} />
      </div>
    );
  }

  const renderRulesSummary = () => {
    if (!list.filters || !list.filters.rules) return 'No rules defined.';
    const opsMap: any = {
      is: 'is', is_not: 'is not', includes: 'includes', excludes: 'excludes',
      contains: 'contains', within_last_days: 'within last N days',
      is_before: 'is before', is_after: 'is after'
    };
    
    return (
      <div className="bg-slate-50 border border-border p-4 rounded-xl mb-6">
        <div className="text-sm font-medium text-slate-700 mb-2">
          People match <strong className="text-primary">{list.filters.operator}</strong> of the following:
        </div>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
          {list.filters.rules.map((rule: any, i: number) => {
            if (rule.field === 'has_no_email') return <li key={i}>Has no email</li>;
            let displayVal = rule.value;
            if (rule.field === 'tag') {
              displayVal = tags.find(t => t.id === rule.value)?.name || 'Unknown Tag';
            }
            return (
              <li key={i} className="capitalize">
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
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{list.name}</h2>
          <p className="text-slate-500 text-sm">{people.length} matching people</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl bg-white shadow-sm gap-2">
            <Edit2 className="h-4 w-4" /> Edit rules
          </Button>
          <Button onClick={handleExport} className="rounded-xl shadow-sm gap-2">
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {renderRulesSummary()}

      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-border text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3">Email</th>
              <th className="px-6 py-3">Phone</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {people.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                  No people match these rules.
                </td>
              </tr>
            ) : (
              people.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-900">{p.first_name} {p.last_name}</td>
                  <td className="px-6 py-3 text-slate-600 capitalize">{p.status}</td>
                  <td className="px-6 py-3 text-slate-500">{p.email || '-'}</td>
                  <td className="px-6 py-3 text-slate-500">{p.phone || '-'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
