'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, X, Play, Save, Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

export function SmartListBuilder({ listId, initialName, initialFilters, tags }: { listId?: string, initialName?: string, initialFilters?: any, tags: any[] }) {
  const router = useRouter();
  const [name, setName] = useState(initialName || '');
  const [operator, setOperator] = useState<'AND' | 'OR'>(initialFilters?.operator || 'AND');
  const [rules, setRules] = useState<any[]>(initialFilters?.rules || [{ field: 'status', op: 'is', value: 'active' }]);
  
  const [previewData, setPreviewData] = useState<{people: any[], total: number} | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const addRule = () => {
    if (rules.length >= 5) return;
    setRules([...rules, { field: 'status', op: 'is', value: 'active' }]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, key: string, value: any) => {
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
    } catch (error: any) {
      toast.error(error.message);
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
        router.push(`/lists/${data.id}`);
      } else {
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in-50 duration-300">
      <div className="bg-white border border-border p-6 rounded-2xl shadow-sm">
        <div className="mb-6 flex gap-4 items-end">
          <div className="flex-1">
            <label className="text-sm font-medium mb-1 block">List Name</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Active Volunteers" className="rounded-xl max-w-md font-semibold" />
          </div>
          <Button onClick={handleSave} disabled={isSaving} className="rounded-xl shadow-sm bg-primary hover:bg-primary/90">
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />} Save list
          </Button>
        </div>

        <div className="bg-slate-50/50 border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4 text-sm font-medium text-slate-700">
            People match
            <Select value={operator} onValueChange={(v: any) => setOperator(v)}>
              <SelectTrigger className="w-24 h-8 rounded-lg bg-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">ALL</SelectItem>
                <SelectItem value="OR">ANY</SelectItem>
              </SelectContent>
            </Select>
            of the following rules:
          </div>

          <div className="space-y-3">
            {rules.map((rule, index) => (
              <div key={index} className="flex items-center gap-3 bg-white border border-border p-2 rounded-xl shadow-sm">
                <Select value={rule.field} onValueChange={v => updateRule(index, 'field', v)}>
                  <SelectTrigger className="w-40 border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
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
                  <Select value={rule.op} onValueChange={v => updateRule(index, 'op', v)}>
                    <SelectTrigger className="w-36 border-none shadow-none focus:ring-0 bg-slate-50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {rule.field === 'status' || rule.field === 'gender' ? (
                        <><SelectItem value="is">is</SelectItem><SelectItem value="is_not">is not</SelectItem></>
                      ) : rule.field === 'tag' ? (
                        <><SelectItem value="includes">includes</SelectItem><SelectItem value="excludes">excludes</SelectItem></>
                      ) : rule.field === 'campus' ? (
                        <><SelectItem value="is">is</SelectItem><SelectItem value="is_not">is not</SelectItem><SelectItem value="contains">contains</SelectItem></>
                      ) : rule.field === 'created_at' ? (
                        <><SelectItem value="within_last_days">within last (days)</SelectItem><SelectItem value="is_before">is before</SelectItem><SelectItem value="is_after">is after</SelectItem></>
                      ) : null}
                    </SelectContent>
                  </Select>
                )}

                <div className="flex-1">
                  {rule.field === 'status' ? (
                    <Select value={rule.value} onValueChange={v => updateRule(index, 'value', v)}>
                      <SelectTrigger className="border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="visitor">Visitor</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="child">Child</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : rule.field === 'gender' ? (
                    <Select value={rule.value} onValueChange={v => updateRule(index, 'value', v)}>
                      <SelectTrigger className="border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : rule.field === 'tag' ? (
                    <Select value={rule.value} onValueChange={v => updateRule(index, 'value', v)}>
                      <SelectTrigger className="border-none shadow-none focus:ring-0"><SelectValue placeholder="Select tag..." /></SelectTrigger>
                      <SelectContent>
                        {tags.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : rule.field === 'has_no_email' ? (
                    <span className="text-slate-400 text-sm italic px-3">True</span>
                  ) : rule.field === 'created_at' && rule.op === 'within_last_days' ? (
                    <Input type="number" value={rule.value} onChange={e => updateRule(index, 'value', e.target.value)} className="border-none shadow-none focus-visible:ring-0 px-3" />
                  ) : rule.field === 'created_at' ? (
                    <Input type="date" value={rule.value} onChange={e => updateRule(index, 'value', e.target.value)} className="border-none shadow-none focus-visible:ring-0 px-3" />
                  ) : (
                    <Input value={rule.value} onChange={e => updateRule(index, 'value', e.target.value)} placeholder="Type a value..." className="border-none shadow-none focus-visible:ring-0 px-3" />
                  )}
                </div>

                <Button variant="ghost" size="icon" onClick={() => removeRule(index)} className="text-slate-400 hover:text-destructive h-8 w-8 mr-1 rounded-lg">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          {rules.length < 5 && (
            <Button variant="outline" size="sm" onClick={addRule} className="mt-4 rounded-xl border-dashed border-2">
              <Plus className="h-4 w-4 mr-2" /> Add rule
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white border border-border p-6 rounded-2xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2"><Users className="h-5 w-5 text-teal-600"/> Live Preview</h3>
          <Button variant="secondary" onClick={runPreview} disabled={isPreviewing || rules.length === 0} className="rounded-xl shadow-sm">
            {isPreviewing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2 text-slate-600" />} Run preview
          </Button>
        </div>

        {previewData ? (
          <div className="animate-in fade-in-50">
            <p className="text-sm text-slate-600 mb-4 bg-teal-50 border border-teal-100 p-3 rounded-xl">
              This list currently matches <strong className="text-teal-900">{previewData.total} people</strong>.
            </p>
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm text-left">
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
                    previewData.people.map((p: any) => (
                      <tr key={p.id}>
                        <td className="px-4 py-2 font-medium text-slate-900">{p.first_name} {p.last_name}</td>
                        <td className="px-4 py-2 text-slate-600 capitalize">{p.status}</td>
                        <td className="px-4 py-2 text-slate-500">{p.email || '-'}</td>
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
          <div className="text-center py-10 border-2 border-dashed border-border rounded-xl">
            <p className="text-slate-500 text-sm">Click "Run preview" to see who matches your rules.</p>
          </div>
        )}
      </div>
    </div>
  );
}
