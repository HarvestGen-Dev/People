'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, X, Play, Save, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type {
  ListPerson,
  ListTag,
  SmartListFilters,
  SmartListRule,
} from '@/lib/types';

interface SmartListBuilderProps {
  listId?: string;
  initialName?: string;
  initialFilters?: SmartListFilters | null;
  tags: ListTag[];
}

const OPERATOR_LABELS: Record<string, string> = {
  is: 'Is',
  is_not: 'Is not',
  includes: 'Includes',
  excludes: 'Excludes',
  contains: 'Contains',
  within_last_days: 'Within last days',
  is_before: 'Is before',
  is_after: 'Is after',
};

export function SmartListBuilder({
  listId,
  initialName,
  initialFilters,
  tags,
}: SmartListBuilderProps) {
  const router = useRouter();
  const [name, setName] = useState(initialName || '');
  const [operator, setOperator] = useState<'AND' | 'OR'>(initialFilters?.operator || 'AND');
  const [rules, setRules] = useState<SmartListRule[]>(
    initialFilters?.rules || [{ field: 'status', op: 'is', value: 'active' }]
  );
  
  const [previewData, setPreviewData] = useState<{
    people: ListPerson[];
    total: number;
  } | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const addRule = () => {
    if (rules.length >= 5) return;
    setRules([...rules, { field: 'status', op: 'is', value: 'active' }]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (
    index: number,
    key: keyof SmartListRule,
    value: string
  ) => {
    const newRules = [...rules];
    newRules[index] = { ...newRules[index], [key]: value };
    
    // Reset op/value if field changes
    if (key === 'field') {
      if (value === 'status') { newRules[index].op = 'is'; newRules[index].value = 'active'; }
      if (value === 'campus') { newRules[index].op = 'is'; newRules[index].value = ''; }
      if (value === 'tag') { newRules[index].op = 'includes'; newRules[index].value = tags[0]?.id || ''; }
      if (value === 'created_at') { newRules[index].op = 'within_last_days'; newRules[index].value = '30'; }
      if (value === 'gender') { newRules[index].op = 'is'; newRules[index].value = 'Male'; }
      if (value === 'has_no_email') { newRules[index].op = ''; newRules[index].value = ''; }
    }
    
    setRules(newRules);
  };

  const runPreview = async () => {
    setIsPreviewing(true);
    try {
      const res = await fetch('/api/admin/lists/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: { operator, rules } })
      });
      if (!res.ok) throw new Error('Failed to run preview');
      const { data } = await res.json();
      setPreviewData(data);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Preview failed');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return toast.error('List name is required');
    if (rules.length === 0) return toast.error('Add at least one rule');

    setIsSaving(true);
    try {
      const payload = {
        name,
        type: 'smart',
        filters: { operator, rules }
      };

      const url = listId ? `/api/admin/lists/${listId}` : '/api/admin/lists';
      const method = listId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Failed to save list');
      const { data } = await res.json();
      
      toast.success('List saved');
      if (!listId) {
        router.push(`/lists/${data.display_id || data.id}`);
      } else {
        router.refresh();
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save list');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in-50 duration-300">
      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-none sm:p-6">
        <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-end">
          <div className="flex-1">
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-emerald-700">
              Smart audience
            </div>
            <label className="mb-2 block text-sm font-semibold text-slate-700">List name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Active Volunteers" className="h-11 max-w-lg rounded-xl bg-slate-50 font-semibold shadow-none" />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="h-11 rounded-xl bg-emerald-700 px-5 font-bold shadow-sm hover:bg-emerald-800">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save list
          </Button>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="mb-5 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-700">
            People match
            <Select value={operator} onValueChange={(value) => setOperator(value === 'OR' ? 'OR' : 'AND')}>
              <SelectTrigger className="h-9 w-24 rounded-xl bg-white font-bold text-emerald-700"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">ALL</SelectItem>
                <SelectItem value="OR">ANY</SelectItem>
              </SelectContent>
            </Select>
            of the following rules:
          </div>

          <div className="space-y-3">
            {rules.map((rule, index) => (
              <div key={index} className="relative grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:grid-cols-[minmax(130px,0.9fr)_minmax(125px,0.8fr)_minmax(160px,1.3fr)_36px] sm:items-center">
                <span className="absolute -left-2.5 top-1/2 hidden h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full bg-emerald-700 text-[9px] font-bold text-white sm:flex">
                  {index + 1}
                </span>
                <Select value={rule.field} onValueChange={v => updateRule(index, 'field', v ?? '')}>
                  <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-white shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="status">Status</SelectItem>
                    <SelectItem value="tag">Tag</SelectItem>
                    <SelectItem value="campus">Campus</SelectItem>
                    <SelectItem value="gender">Gender</SelectItem>
                    <SelectItem value="created_at">Created at</SelectItem>
                    <SelectItem value="has_no_email">Has no email</SelectItem>
                  </SelectContent>
                </Select>

                {rule.field !== 'has_no_email' && (
                  <Select value={rule.op} onValueChange={v => updateRule(index, 'op', v ?? '')}>
                    <SelectTrigger className="h-10 w-full rounded-xl border-slate-200 bg-slate-50 shadow-none">
                      <SelectValue>{(value) => OPERATOR_LABELS[value] || value}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {rule.field === 'status' || rule.field === 'gender' ? (
                        <><SelectItem value="is">Is</SelectItem><SelectItem value="is_not">Is not</SelectItem></>
                      ) : rule.field === 'tag' ? (
                        <><SelectItem value="includes">Includes</SelectItem><SelectItem value="excludes">Excludes</SelectItem></>
                      ) : rule.field === 'campus' ? (
                        <><SelectItem value="is">Is</SelectItem><SelectItem value="is_not">Is not</SelectItem><SelectItem value="contains">Contains</SelectItem></>
                      ) : rule.field === 'created_at' ? (
                        <><SelectItem value="within_last_days">Within last days</SelectItem><SelectItem value="is_before">Is before</SelectItem><SelectItem value="is_after">Is after</SelectItem></>
                      ) : null}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex-1">
                  {rule.field === 'status' ? (
                    <Select value={rule.value ?? ''} onValueChange={v => updateRule(index, 'value', v ?? '')}>
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="visitor">Visitor</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : rule.field === 'gender' ? (
                    <Select value={rule.value ?? ''} onValueChange={v => updateRule(index, 'value', v ?? '')}>
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : rule.field === 'tag' ? (
                    <Select value={rule.value ?? ''} onValueChange={v => updateRule(index, 'value', v ?? '')}>
                      <SelectTrigger className="h-10 rounded-xl border-slate-200 shadow-none"><SelectValue placeholder="Select tag..." /></SelectTrigger>
                      <SelectContent>
                        {tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : rule.field === 'has_no_email' ? (
                    <span className="flex h-10 items-center rounded-xl bg-emerald-50 px-3 text-sm font-semibold text-emerald-700">Yes</span>
                  ) : rule.field === 'created_at' && rule.op === 'within_last_days' ? (
                    <Input type="number" value={rule.value ?? ''} onChange={e => updateRule(index, 'value', e.target.value)} className="h-10 rounded-xl border-slate-200 px-3 shadow-none" />
                  ) : rule.field === 'created_at' ? (
                    <Input type="date" value={rule.value ?? ''} onChange={e => updateRule(index, 'value', e.target.value)} className="h-10 rounded-xl border-slate-200 px-3 shadow-none" />
                  ) : (
                    <Input value={rule.value ?? ''} onChange={e => updateRule(index, 'value', e.target.value)} placeholder="Type a value..." className="h-10 rounded-xl border-slate-200 px-3 shadow-none" />
                  )}
                </div>

                <Button aria-label={`Remove rule ${index + 1}`} variant="ghost" size="icon" onClick={() => removeRule(index)} className="h-9 w-9 rounded-xl text-slate-400 hover:text-destructive">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {rules.length < 5 && (
            <Button variant="outline" size="sm" onClick={addRule} className="mt-4 rounded-xl border-2 border-dashed bg-white">
              <Plus className="h-4 w-4 mr-2" /> Add rule
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-none sm:p-6">
        <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-950"><Users className="h-5 w-5 text-emerald-700"/> Audience preview</h3>
            <p className="mt-1 text-xs text-slate-500">Test the rules before saving this list.</p>
          </div>
          <Button variant="secondary" onClick={runPreview} disabled={isPreviewing || rules.length === 0} className="h-10 rounded-xl shadow-none">
            {isPreviewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2 text-slate-600" />} Run preview
          </Button>
        </div>

        {previewData ? (
          <div className="animate-in fade-in-50">
            <p className="mb-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
              This list currently matches <strong>{previewData.total} people</strong>.
            </p>
            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    <th className="px-4 py-2 font-medium text-slate-500">Name</th>
                    <th className="px-4 py-2 font-medium text-slate-500">Status</th>
                    <th className="px-4 py-2 font-medium text-slate-500">Email</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {previewData.people.length === 0 ? (
                    <tr><td colSpan={3} className="px-4 py-6 text-center text-slate-500">No matches found</td></tr>
                  ) : (
                    previewData.people.map((person) => (
                      <tr key={person.id}>
                        <td className="px-4 py-2 font-medium text-slate-900">{person.first_name} {person.last_name}</td>
                        <td className="px-4 py-2 text-slate-600 capitalize">{person.status}</td>
                        <td className="px-4 py-2 text-slate-500">{person.email || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {previewData.total > 10 && (
                <div className="bg-slate-50 p-2 text-center text-xs text-slate-500 border-t border-border">
                  Showing first 10 of {previewData.total}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-12 text-center">
            <Users className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-3 text-sm font-medium text-slate-500">Run a preview to see who matches these rules.</p>
          </div>
        )}
      </div>
    </div>
  );
}
