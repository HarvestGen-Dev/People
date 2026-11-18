'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { sendJson } from '../../api';

const STATUSES = [
  { value: 'new', label: 'New' }, { value: 'contacted', label: 'Contacted' },
  { value: 'in_progress', label: 'In progress' }, { value: 'completed', label: 'Completed' },
] as const;
const selectClass = 'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm';

interface SubmissionControlsProps {
  submissionId: string;
  status: string;
  assignedTo: string | null;
  assignable: { userId: string; email: string }[];
}

export function SubmissionControls({ submissionId, status, assignedTo, assignable }: SubmissionControlsProps) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState(status);
  const [assignee, setAssignee] = useState(assignedTo ?? '');
  const [busy, setBusy] = useState(false);
  const changed = nextStatus !== status || assignee !== (assignedTo ?? '');

  const save = async () => {
    setBusy(true);
    try {
      await sendJson('PATCH', `/api/admin/hg-link/submissions/${submissionId}`, { status: nextStatus, assignedTo: assignee || null });
      toast.success('Follow-up updated');
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="followup-heading" className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
      <h2 id="followup-heading" className="text-base font-semibold sm:col-span-2">Follow-up</h2>
      <div className="space-y-1.5">
        <Label htmlFor="sub-status">Status</Label>
        <select id="sub-status" className={selectClass} value={nextStatus} onChange={(e) => setNextStatus(e.target.value)}>
          {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sub-assignee">Assigned to</Label>
        <select id="sub-assignee" className={selectClass} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Unassigned</option>
          {assignable.map((m) => <option key={m.userId} value={m.userId}>{m.email}</option>)}
        </select>
      </div>
      <div className="sm:col-span-2"><Button disabled={busy || !changed} onClick={save}>{busy ? 'Saving…' : 'Save follow-up'}</Button></div>
    </section>
  );
}
