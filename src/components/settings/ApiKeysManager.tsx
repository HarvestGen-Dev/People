'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Copy, CheckCircle2, Loader2, Key } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';

const SCOPES = [
  { id: 'people:read', label: 'people:read', desc: 'Read person profiles and lists' },
  { id: 'people:write', label: 'people:write', desc: 'Create and update people' },
  { id: 'people:lookup', label: 'people:lookup', desc: 'Find or create a person by email/phone' },
  { id: 'events:read', label: 'events:read', desc: 'Read a person\'s activity timeline' },
  { id: 'events:write', label: 'events:write', desc: 'Push activity events to a person\'s timeline' },
];

export function ApiKeysManager({ initialKeys, churchId }: { initialKeys: any[], churchId: string }) {
  const [keys, setKeys] = useState(initialKeys);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [formData, setFormData] = useState({ name: '', description: '', scopes: [] as string[], expires_at: '' });
  const [hasExpiry, setHasExpiry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [revokeId, setRevokeId] = useState<string | null>(null);

  const resetForm = () => {
    setStep(1);
    setFormData({ name: '', description: '', scopes: ['people:read', 'people:lookup', 'events:write'], expires_at: '' });
    setHasExpiry(false);
    setNewRawKey(null);
    setCopied(false);
  };

  const openCreate = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const toggleScope = (scopeId: string) => {
    setFormData(prev => ({
      ...prev,
      scopes: prev.scopes.includes(scopeId) 
        ? prev.scopes.filter(s => s !== scopeId)
        : [...prev.scopes, scopeId]
    }));
  };

  const handleCreate = async () => {
    if (!formData.name.trim()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description,
        scopes: formData.scopes,
        expires_at: hasExpiry && formData.expires_at ? new Date(formData.expires_at).toISOString() : null
      };

      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to create API key');
      const { data } = await res.json();

      setNewRawKey(data.rawKey);
      setKeys([data.apiKey, ...keys]);
      setStep(4);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevoke = async () => {
    if (!revokeId) return;
    try {
      const res = await fetch(`/api/admin/api-keys/${revokeId}/revoke`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Failed to revoke API key');
      
      setKeys(keys.map(k => k.id === revokeId ? { ...k, is_active: false } : k));
      toast.success('API key revoked');
      setRevokeId(null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const copyToClipboard = () => {
    if (!newRawKey) return;
    navigator.clipboard.writeText(newRawKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div>
      <div className="bg-white border border-border p-6 rounded-2xl mb-8 shadow-sm">
        <div className="flex gap-4">
          <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center shrink-0">
            <Key className="h-6 w-6 text-teal-600" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">API keys</h3>
            <p className="text-slate-500">
              API keys let external systems like Shepherd and Drip & Brew securely read and write data in People. 
              Each key has scoped permissions — grant only what each system needs.
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-end mb-4">
        <Button onClick={openCreate} className="rounded-xl shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> New API key
        </Button>
      </div>

      <div className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50/50 border-b border-border text-slate-500 font-medium">
            <tr>
              <th className="px-6 py-3">Name</th>
              <th className="px-6 py-3">Prefix</th>
              <th className="px-6 py-3">Scopes</th>
              <th className="px-6 py-3">Last used</th>
              <th className="px-6 py-3">Expires</th>
              <th className="px-6 py-3">Status</th>
              <th className="px-6 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {keys.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-8 text-center text-slate-500">
                  No API keys yet. Create one to connect external systems.
                </td>
              </tr>
            ) : (
              keys.map(k => (
                <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-slate-900">{k.name}</td>
                  <td className="px-6 py-3 font-mono text-xs text-slate-500">{k.key_prefix}••••••</td>
                  <td className="px-6 py-3">
                    <div className="flex flex-wrap gap-1">
                      {k.scopes.map((s: string) => (
                        <span key={s} className="bg-slate-100 text-slate-600 text-[10px] px-1.5 py-0.5 rounded border border-slate-200">
                          {s}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {k.last_used_at ? formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true }) : 'Never'}
                  </td>
                  <td className="px-6 py-3 text-slate-500 text-xs">
                    {k.expires_at ? format(new Date(k.expires_at), 'MMM d, yyyy') : 'Never'}
                  </td>
                  <td className="px-6 py-3">
                    {k.is_active ? (
                      <span className="text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-md text-xs">Active</span>
                    ) : (
                      <span className="text-slate-500 font-medium bg-slate-100 px-2 py-0.5 rounded-md text-xs">Revoked</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-right">
                    {k.is_active && (
                      <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10 h-8" onClick={() => setRevokeId(k.id)}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        // Prevent closing by clicking outside if on step 4
        if (step === 4 && !open) return;
        setIsDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{step === 4 ? 'Save your API key' : 'New API key'}</DialogTitle>
            {step === 4 && (
              <DialogDescription className="text-amber-600 font-medium mt-2">
                Your API key has been created. Copy it now — it will never be shown again.
              </DialogDescription>
            )}
          </DialogHeader>

          {step === 1 && (
            <div className="py-2 space-y-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Name</label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Shepherd LMS" className="rounded-xl" autoFocus />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Description (optional)</label>
                <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="rounded-xl min-h-[80px]" />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="py-2 space-y-3 max-h-[400px] overflow-y-auto">
              <label className="text-sm font-medium mb-1 block">Permissions</label>
              {SCOPES.map(scope => (
                <div key={scope.id} className="flex items-start space-x-3 p-3 border border-border rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <Checkbox 
                    id={scope.id} 
                    checked={formData.scopes.includes(scope.id)} 
                    onCheckedChange={() => toggleScope(scope.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <label htmlFor={scope.id} className="text-sm font-medium leading-none cursor-pointer text-slate-900 block mb-1">
                      {scope.label}
                    </label>
                    <p className="text-xs text-slate-500 leading-snug">{scope.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {step === 3 && (
            <div className="py-2 space-y-4">
              <label className="text-sm font-medium mb-1 block">Expiration</label>
              
              <div className="space-y-3">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!hasExpiry} onChange={() => setHasExpiry(false)} className="text-primary focus:ring-primary h-4 w-4" />
                  Never expires
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={hasExpiry} onChange={() => setHasExpiry(true)} className="text-primary focus:ring-primary h-4 w-4" />
                  Expires on date
                </label>
              </div>

              {hasExpiry && (
                <div className="pl-6 pt-2">
                  <Input type="date" value={formData.expires_at} onChange={e => setFormData({ ...formData, expires_at: e.target.value })} className="rounded-xl" />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="py-4">
              <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mb-4 p-1">
                <div className="flex-1 font-mono text-sm px-3 py-2 text-slate-700 overflow-x-auto whitespace-nowrap scrollbar-hide flex items-center">
                  {newRawKey}
                </div>
                <Button variant="secondary" onClick={copyToClipboard} className="shrink-0 h-9 rounded-lg shadow-sm">
                  {copied ? <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" /> : <Copy className="h-4 w-4 mr-2" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              
              <p className="text-xs text-slate-500 leading-snug border-l-2 border-amber-300 pl-3">
                ⚠ Store this key somewhere safe. If you lose it, you'll need to create a new one.
              </p>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border mt-4">
            {step < 4 ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
                {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step - 1 as any)} className="rounded-xl">Back</Button>}
                
                {step < 3 ? (
                  <Button type="button" onClick={() => setStep(step + 1 as any)} disabled={!formData.name.trim()} className="rounded-xl shadow-sm">Next step</Button>
                ) : (
                  <Button type="button" onClick={handleCreate} disabled={isSubmitting || (hasExpiry && !formData.expires_at)} className="rounded-xl shadow-sm">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create API key
                  </Button>
                )}
              </>
            ) : (
              <Button type="button" onClick={() => setIsDialogOpen(false)} className="rounded-xl w-full">
                I've saved my key
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke Dialog */}
      <Dialog open={!!revokeId} onOpenChange={(open) => !open && setRevokeId(null)}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle>Revoke API Key</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-slate-600">Are you sure? This will immediately break any systems using this key.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRevokeId(null)} className="rounded-xl">Cancel</Button>
            <Button variant="destructive" onClick={handleRevoke} className="rounded-xl shadow-sm">Revoke Key</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
