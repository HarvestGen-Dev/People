'use client';

import { useState } from 'react';
import { EventRegistration } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDistanceToNow } from 'date-fns';
import { Check, X, Loader2, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function RegistrationsTable({ registrations, eventId, isFreeEvent }: { registrations: EventRegistration[], eventId: string, isFreeEvent: boolean }) {
  const [filter, setFilter] = useState<'all' | 'pending_review' | 'approved' | 'rejected'>('pending_review');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const [rejectDialogId, setRejectDialogId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const filteredRegs = registrations.filter(r => filter === 'all' || r.status === filter);

  const handleApprove = async (id: string) => {
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/registrations/${id}/approve`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to approve');
      toast.success('Approved — confirmation email sent');
      window.location.reload(); // Quick refresh for now
    } catch (err: any) {
      toast.error(err.message);
      setLoadingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const handleReject = async () => {
    if (!rejectDialogId) return;
    setLoadingIds(prev => new Set(prev).add(rejectDialogId));
    try {
      const res = await fetch(`/api/admin/registrations/${rejectDialogId}/reject`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason })
      });
      if (!res.ok) throw new Error('Failed to reject');
      toast.success('Registration rejected');
      setRejectDialogId(null);
      setRejectReason('');
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
      setLoadingIds(prev => { const n = new Set(prev); n.delete(rejectDialogId); return n; });
    }
  };

  const handleBulkApprove = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    setLoadingIds(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    try {
      const res = await fetch(`/api/admin/registrations/bulk-approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
      });
      if (!res.ok) throw new Error('Bulk approve failed');
      toast.success(`Approved ${ids.length} registrations`);
      setSelectedIds(new Set());
      window.location.reload();
    } catch (err: any) {
      toast.error(err.message);
      setLoadingIds(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredRegs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredRegs.map(r => r.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex bg-muted/50 p-1 rounded-xl">
          {['pending_review', 'approved', 'rejected'].map(tab => (
            <button
              key={tab}
              onClick={() => { setFilter(tab as any); setSelectedIds(new Set()); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${filter === tab ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
        
        {filter === 'pending_review' && selectedIds.size > 0 && (
          <Button onClick={handleBulkApprove} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            Approve selected ({selectedIds.size})
          </Button>
        )}
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50/50 border-b border-border text-slate-500 font-medium">
              <tr>
                {filter === 'pending_review' && (
                  <th className="px-4 py-3 w-10">
                    <Checkbox checked={selectedIds.size === filteredRegs.length && filteredRegs.length > 0} onCheckedChange={toggleSelectAll} />
                  </th>
                )}
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Guests</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment proof</th>
                <th className="px-4 py-3">Paid checkbox</th>
                <th className="px-4 py-3">Submitted</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredRegs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                    No registrations found for this status.
                  </td>
                </tr>
              ) : (
                filteredRegs.map(reg => (
                  <tr key={reg.id} className="hover:bg-slate-50/50 transition-colors">
                    {filter === 'pending_review' && (
                      <td className="px-4 py-3">
                        <Checkbox checked={selectedIds.has(reg.id)} onCheckedChange={() => toggleSelect(reg.id)} />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{reg.first_name} {reg.last_name}</div>
                      <div className="text-slate-500 text-xs">{reg.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{reg.guests}</td>
                    <td className="px-4 py-3 text-slate-900 font-medium">RM {reg.amount_due}</td>
                    <td className="px-4 py-3">
                      {reg.payment_proof_url ? (
                        <div 
                          className="w-12 h-8 bg-slate-100 rounded border border-border cursor-pointer overflow-hidden flex items-center justify-center hover:opacity-80"
                          onClick={() => setLightboxUrl(reg.payment_proof_url)}
                        >
                          <img src={reg.payment_proof_url} className="w-full h-full object-cover" alt="Proof" />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">{isFreeEvent ? 'No proof (Free)' : 'None'}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {reg.paid_checkbox ? <Check className="h-4 w-4 text-emerald-500" /> : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">
                      {formatDistanceToNow(new Date(reg.created_at), { addSuffix: true })}
                    </td>
                    <td className="px-4 py-3">
                      {filter === 'pending_review' ? (
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleApprove(reg.id)}
                            disabled={loadingIds.has(reg.id)}
                          >
                            {loadingIds.has(reg.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approve'}
                          </Button>
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 text-destructive hover:bg-destructive/10"
                            onClick={() => setRejectDialogId(reg.id)}
                            disabled={loadingIds.has(reg.id)}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          {reg.status === 'approved' ? (
                            <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded-md">Approved</span>
                          ) : (
                            <span className="text-destructive font-medium bg-destructive/10 px-2 py-1 rounded-md">Rejected</span>
                          )}
                          <div className="mt-1">by {reg.reviewed_by || 'System'}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setLightboxUrl(null)}>
          <div className="relative max-w-4xl max-h-screen">
            <button className="absolute -top-12 right-0 text-white/70 hover:text-white" onClick={() => setLightboxUrl(null)}>
              <X className="h-8 w-8" />
            </button>
            <img src={lightboxUrl} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} alt="Full payment proof" />
          </div>
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectDialogId} onOpenChange={(open) => !open && setRejectDialogId(null)}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reject Registration</DialogTitle>
            <DialogDescription>
              This will reject the registration. The registrant will not be notified automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium mb-2 block">Reason (optional)</label>
            <Textarea 
              value={rejectReason} 
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Payment amount incorrect..."
              className="rounded-xl min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectDialogId(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleReject} disabled={loadingIds.has(rejectDialogId || '')} className="rounded-xl">
              {loadingIds.has(rejectDialogId || '') && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reject Registration
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
