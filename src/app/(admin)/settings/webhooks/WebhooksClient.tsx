'use client'

import { useState } from 'react'
import { Webhook, WebhookDelivery } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Plus, Check, X, Trash2, Edit2, Play, ChevronRight, Activity } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { useRouter } from 'next/navigation'

const EVENT_TYPES = [
  { id: 'person.created', label: 'person.created', desc: 'A new person is added to People' },
  { id: 'person.updated', label: 'person.updated', desc: "A person's profile is updated" },
  { id: 'person.status_changed', label: 'person.status_changed', desc: "A person's status changes" },
  { id: 'event.logged', label: 'event.logged', desc: 'An integration event is logged' }
]

export function WebhooksClient({ initialWebhooks }: { initialWebhooks: Webhook[] }) {
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isTestOpen, setIsTestOpen] = useState(false)
  const [selectedWebhook, setSelectedWebhook] = useState<Webhook | null>(null)
  
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [selectedEvents, setSelectedEvents] = useState<string[]>([])
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; duration: number; error?: string } | null>(null)
  
  const toast = ({ title }: { title: string; variant?: 'destructive' }) =>
    window.alert(title)
  const router = useRouter()

  const handleCreate = async () => {
    if (!name || !url || selectedEvents.length === 0) {
      toast({ title: 'Please fill all required fields', variant: 'destructive' })
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, url, events: selectedEvents })
      })

      if (!res.ok) throw new Error('Failed to create webhook')
      
      const newWebhook = await res.json()
      setWebhooks([newWebhook, ...webhooks])
      setIsCreateOpen(false)
      setName('')
      setUrl('')
      setSelectedEvents([])
      toast({ title: 'Webhook created successfully' })
    } catch (err) {
      toast({ title: 'Error creating webhook', variant: 'destructive' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this webhook?')) return

    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      
      setWebhooks(webhooks.filter(w => w.id !== id))
      toast({ title: 'Webhook deleted' })
    } catch (err) {
      toast({ title: 'Error deleting webhook', variant: 'destructive' })
    }
  }

  const handleToggle = async (id: string, is_active: boolean) => {
    try {
      const res = await fetch(`/api/admin/webhooks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !is_active })
      })
      if (!res.ok) throw new Error('Failed to update')
      
      setWebhooks(webhooks.map(w => w.id === id ? { ...w, is_active: !is_active } : w))
    } catch (err) {
      toast({ title: 'Error updating webhook', variant: 'destructive' })
    }
  }

  const handleTest = async () => {
    if (!selectedWebhook) return
    setIsSubmitting(true)
    setTestResult(null)

    try {
      const res = await fetch(`/api/admin/webhooks/${selectedWebhook.id}/test`, { method: 'POST' })
      const data = await res.json()
      
      if (!res.ok) throw new Error(data.error || 'Test failed')
      
      setTestResult({ success: true, duration: data.duration })
    } catch (err: unknown) {
      setTestResult({
        success: false,
        duration: 0,
        error: err instanceof Error ? err.message : 'Test failed',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const [isDeliveriesOpen, setIsDeliveriesOpen] = useState(false)
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([])
  const [isLoadingDeliveries, setIsLoadingDeliveries] = useState(false)

  const handleViewDeliveries = async (webhook: Webhook) => {
    setSelectedWebhook(webhook)
    setIsDeliveriesOpen(true)
    setIsLoadingDeliveries(true)
    try {
      const res = await fetch(`/api/admin/webhooks/${webhook.id}/deliveries`)
      if (!res.ok) throw new Error('Failed to fetch deliveries')
      const data = await res.json()
      setDeliveries(data)
    } catch (err) {
      toast({ title: 'Error fetching deliveries', variant: 'destructive' })
    } finally {
      setIsLoadingDeliveries(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="bg-slate-50 border-slate-200">
        <CardContent className="pt-6">
          <p className="text-slate-600">
            Webhooks let People notify your other systems when something changes. For example, when a new visitor is added, Shepherd can automatically create an account for them.
          </p>
        </CardContent>
      </Card>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold text-slate-900">Configured Webhooks</h2>
        <Button onClick={() => setIsCreateOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" /> Add webhook
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200">
            <tr>
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">URL</th>
              <th className="px-6 py-4">Events</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Last delivery</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {webhooks.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                  No webhooks configured.
                </td>
              </tr>
            ) : (
              webhooks.map((webhook) => (
                <tr key={webhook.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{webhook.name}</td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {webhook.url.length > 40 ? webhook.url.substring(0, 40) + '...' : webhook.url}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {webhook.events.map(ev => (
                        <Badge key={ev} variant="outline" className="text-xs">{ev}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggle(webhook.id, webhook.is_active)}
                      className={`px-2 py-1 rounded-full text-xs font-medium ${webhook.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                    >
                      {webhook.is_active ? 'Active' : 'Paused'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const deliveries = webhook.deliveries || []
                      if (deliveries.length === 0) return <span className="text-slate-400 text-xs">Never</span>
                      // Sort by most recent
                      const last = [...deliveries].sort((a, b) => {
                        const aDate = a.delivered_at || a.failed_at || '0'
                        const bDate = b.delivered_at || b.failed_at || '0'
                        return new Date(bDate).getTime() - new Date(aDate).getTime()
                      })[0]
                      
                      const date = last.delivered_at || last.failed_at || last.created_at
                      const success = !!last.delivered_at
                      return (
                        <div className="flex items-center gap-2">
                          {success ? <Check className="w-4 h-4 text-emerald-500" /> : <X className="w-4 h-4 text-red-500" />}
                          <span className="text-xs text-slate-600">
                            {new Date(date).toLocaleDateString()} {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      title="View Deliveries"
                      onClick={() => handleViewDeliveries(webhook)}
                    >
                      <Activity className="w-4 h-4 text-slate-500 hover:text-teal-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      title="Test Webhook"
                      onClick={() => {
                        setSelectedWebhook(webhook)
                        setIsTestOpen(true)
                        setTestResult(null)
                      }}
                    >
                      <Play className="w-4 h-4 text-slate-500 hover:text-teal-600" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(webhook.id)}>
                      <Trash2 className="w-4 h-4 text-slate-500 hover:text-red-600" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Webhook</DialogTitle>
            <DialogDescription>
              Configure an endpoint to receive events from People.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input placeholder="e.g. Notify Shepherd of new visitors" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>URL</Label>
              <Input type="url" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} />
            </div>

            <div className="space-y-3">
              <Label>Events</Label>
              <div className="space-y-2 border rounded-lg p-4 bg-slate-50/50">
                {EVENT_TYPES.map(type => (
                  <div key={type.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={type.id}
                      checked={selectedEvents.includes(type.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedEvents([...selectedEvents, type.id])
                        } else {
                          setSelectedEvents(selectedEvents.filter(id => id !== type.id))
                        }
                      }}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label htmlFor={type.id} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                        {type.label}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {type.desc}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
              {isSubmitting ? 'Saving...' : 'Save Webhook'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isTestOpen} onOpenChange={setIsTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Webhook</DialogTitle>
            <DialogDescription>
              Send a test payload to {selectedWebhook?.url}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div className="bg-slate-900 text-slate-300 p-4 rounded-lg font-mono text-xs overflow-x-auto">
              <pre>{JSON.stringify({
                event: "webhook.test",
                timestamp: new Date().toISOString(),
                data: { message: "This is a test delivery from People (HarvestGen)" }
              }, null, 2)}</pre>
            </div>

            {testResult && (
              <div className={`p-4 rounded-lg flex items-center gap-3 ${testResult.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {testResult.success ? <Check className="w-5 h-5 text-emerald-600" /> : <X className="w-5 h-5 text-red-600" />}
                <div>
                  <p className="font-medium text-sm">
                    {testResult.success ? 'Delivered successfully' : 'Delivery failed'}
                  </p>
                  <p className="text-xs opacity-80 mt-0.5">
                    {testResult.success ? `Response received in ${testResult.duration}ms` : testResult.error}
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTestOpen(false)}>Close</Button>
            <Button onClick={handleTest} disabled={isSubmitting} className="bg-teal-600 hover:bg-teal-700">
              {isSubmitting ? 'Sending...' : 'Send Test Payload'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isDeliveriesOpen} onOpenChange={setIsDeliveriesOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Delivery Log</DialogTitle>
            <DialogDescription>
              Recent deliveries for {selectedWebhook?.name}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {isLoadingDeliveries ? (
              <p className="text-center text-slate-500">Loading deliveries...</p>
            ) : deliveries.length === 0 ? (
              <p className="text-center text-slate-500 py-8 border rounded-lg bg-slate-50">No deliveries found.</p>
            ) : (
              <div className="border rounded-lg overflow-hidden max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-slate-500 border-b sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Event</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Response</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {deliveries.map(d => (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-slate-600">
                          {new Date(d.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-700">{d.event_type}</td>
                        <td className="px-4 py-3">
                          {d.delivered_at ? (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded-full">
                              <Check className="w-3 h-3" /> {d.response_status || 'OK'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-2 py-1 rounded-full">
                              <X className="w-3 h-3" /> {d.response_status || 'Error'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-xs truncate" title={d.error_message || 'Success'}>
                          {d.error_message || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeliveriesOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
