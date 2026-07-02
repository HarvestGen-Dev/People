'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Copy, CheckCircle2, Loader2, ShieldCheck } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { toast } from 'sonner';
import type { ApiKey } from '@/lib/types';

const SCOPES = [
  { id: 'people:read', label: 'people:read', desc: 'Read person profiles and lists' },
  { id: 'people:write', label: 'people:write', desc: 'Create and update people' },
  { id: 'people:lookup', label: 'people:lookup', desc: 'Find or create a person by email/phone' },
  { id: 'events:read', label: 'events:read', desc: 'Read a person\'s activity timeline' },
  { id: 'events:write', label: 'events:write', desc: 'Push activity events to a person\'s timeline' },
];

type ApiKeySummary = Pick<
  ApiKey,
  'id' | 'name' | 'key_prefix' | 'scopes' | 'is_active' | 'expires_at' | 'last_used_at' | 'created_at'
>;

export function ApiKeysManager({ initialKeys }: { initialKeys: ApiKeySummary[] }) {
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to create API key');
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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to revoke API key');
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
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Integration access
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950">
            API keys
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Issue tenant-bound credentials and grant only the scopes each system needs.
          </p>
        </div>
        <Button onClick={openCreate} className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800">
          <Plus className="h-4 w-4" /> New API key
        </Button>
      </header>

      <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
        The complete key is shown once after creation. Stored records contain only a
        hash and a short identifying prefix.
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <caption className="sr-only">API keys, permissions, usage, and status</caption>
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
                <label htmlFor="api-key-name" className="text-sm font-medium mb-1 block">Name</label>
                <Input id="api-key-name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="e.g. Shepherd LMS" className="rounded-xl" autoFocus />
              </div>
              <div>
                <label htmlFor="api-key-description" className="text-sm font-medium mb-1 block">Description (optional)</label>
                <Textarea id="api-key-description" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="rounded-xl min-h-[80px]" />
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
                ⚠ Store this key somewhere safe. If you lose it, you&apos;ll need to create a new one.
              </p>
            </div>
          )}

          <DialogFooter className="pt-4 border-t border-border mt-4">
            {step < 4 ? (
              <>
                <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
                {step > 1 && <Button type="button" variant="outline" onClick={() => setStep(step === 3 ? 2 : 1)} className="rounded-xl">Back</Button>}
                
                {step < 3 ? (
                  <Button type="button" onClick={() => setStep(step === 1 ? 2 : 3)} disabled={!formData.name.trim()} className="rounded-xl shadow-sm">Next step</Button>
                ) : (
                  <Button type="button" onClick={handleCreate} disabled={isSubmitting || (hasExpiry && !formData.expires_at)} className="rounded-xl shadow-sm">
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create API key
                  </Button>
                )}
              </>
            ) : (
              <Button type="button" onClick={() => setIsDialogOpen(false)} className="rounded-xl w-full">
                I&apos;ve saved my key
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
