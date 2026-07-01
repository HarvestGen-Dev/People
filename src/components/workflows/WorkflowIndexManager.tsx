'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Plus, Shuffle, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { WorkflowSummary } from '@/lib/types';

// <!-- AGENT: FRONTEND -->
export function WorkflowIndexManager({ initialWorkflows }: { initialWorkflows: WorkflowSummary[] }) {
  const router = useRouter();
  const [workflows, setWorkflows] = useState(initialWorkflows);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      
      if (!res.ok) throw new Error('Failed to create workflow');
      const { data } = await res.json();
      
      toast.success('Workflow created');
      router.push(`/workflows/${data.id}`);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create workflow');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Workflows</h2>
          <p className="text-slate-500 text-sm mt-1">Kanban pipelines for visitor follow-up and next steps.</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} className="rounded-xl shadow-sm bg-primary hover:bg-primary/90 gap-2">
          <Plus className="h-4 w-4" /> New workflow
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="bg-white border border-border p-12 rounded-2xl text-center shadow-sm">
          <Shuffle className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-slate-900 mb-1">No workflows yet</h3>
          <p className="text-slate-500 text-sm mb-4">Create a workflow to track people through a pipeline.</p>
          <Button onClick={() => setIsDialogOpen(true)} variant="outline" className="rounded-xl">Create workflow</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workflows.map(w => (
            <div key={w.id} className="bg-white border border-border rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col group">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
                  <Shuffle className="h-5 w-5 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 leading-tight">{w.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-1">{w.description || 'No description'}</p>
                </div>
              </div>
              
              <div className="bg-slate-50 rounded-lg p-3 text-sm flex items-center gap-2 mb-4 mt-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-slate-700 font-medium">Active</span>
                <span className="text-slate-400">·</span>
                <span className="text-slate-600">{w.steps_count} steps</span>
              </div>

              <div className="flex items-center justify-between text-sm text-slate-500 mb-4 px-1">
                <div className="font-medium text-slate-700"><span className="text-slate-900">{w.active_cards}</span> active</div>
                <div>·</div>
                <div><span className="text-slate-900 font-medium">{w.completed_cards}</span> completed</div>
              </div>

              <div className="mt-auto">
                <Button variant="outline" onClick={() => router.push(`/workflows/${w.id}`)} className="w-full rounded-xl justify-between group-hover:border-teal-200 group-hover:bg-teal-50/50 transition-colors">
                  Open board <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-teal-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>New Workflow</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. New Visitor Journey" className="rounded-xl" autoFocus />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description (optional)</label>
              <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} placeholder="What is this workflow for?" className="rounded-xl" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
            <Button onClick={handleCreate} disabled={!formData.name.trim() || isSaving} className="rounded-xl shadow-sm">
              {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null} Create workflow
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
