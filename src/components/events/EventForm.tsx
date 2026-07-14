'use client';

import { Controller } from 'react-hook-form';
import { Event } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Loader2, Image as ImageIcon, QrCode, AlertCircle } from 'lucide-react';
import { renderSafeMarkdown } from '@/lib/safe-markdown';
import { useEventForm } from '@/hooks/events/useEventForm';

interface EventFormProps {
  event?: Event;
  workflows?: { id: string; name: string }[];
}

export function EventForm({ event, workflows }: EventFormProps) {
  const {
    form,
    isEdit,
    isSubmitting,
    coverUrl,
    setCoverUrl,
    setCoverFile,
    qrUrl,
    handleFileSelect,
    onSubmit,
  } = useEventForm(event);

  const { register, handleSubmit, control, watch, formState: { errors } } = form;
  const watchDescription = watch('description');
  const watchPrice = watch('price');

  return (
    <div className="space-y-5 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-xl">
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-950">Event details</CardTitle>
          <CardDescription>Core details about the event.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Event Name <span className="text-red-500">*</span></label>
              <Input {...register('name')} className="h-12 rounded-xl bg-slate-50 text-lg font-semibold shadow-none" placeholder="e.g. Youth Camp 2026" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message as string}</p>}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Public URL Slug <span className="text-red-500">*</span></label>
              <div className="flex items-center">
                <span className="flex h-11 items-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-50 px-3 text-sm text-slate-400">
                  people.harvestgen.org/e/
                </span>
                <Input {...register('slug')} className="rounded-l-none rounded-r-xl" placeholder="youth-camp-2026" />
              </div>
              {errors.slug && <p className="text-xs text-destructive mt-1">{errors.slug.message as string}</p>}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Tabs defaultValue="write" className="w-full overflow-hidden rounded-2xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-3 py-2">
                  <TabsList className="h-8 bg-transparent p-0">
                    <TabsTrigger value="write" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-3 text-xs">Write</TabsTrigger>
                    <TabsTrigger value="preview" className="data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-md px-3 text-xs">Preview</TabsTrigger>
                  </TabsList>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Markdown supported</span>
                </div>
                <TabsContent value="write" className="m-0 border-0">
                  <Textarea 
                    {...register('description')} 
                    className="min-h-[200px] border-0 focus-visible:ring-0 rounded-none resize-y" 
                    placeholder="Describe the event..." 
                  />
                </TabsContent>
                <TabsContent value="preview" className="m-0 border-0 p-4 min-h-[200px] prose prose-sm max-w-none">
                  {watchDescription ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: renderSafeMarkdown(watchDescription),
                      }}
                    />
                  ) : (
                    <p className="text-muted-foreground italic">Nothing to preview</p>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Location</label>
                <Input {...register('location')} className="rounded-xl" placeholder="e.g. Main Hall or Zoom Link" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium mb-1 block">Start <span className="text-red-500">*</span></label>
                  <Input type="datetime-local" {...register('start_at')} className="rounded-xl" />
                  {errors.start_at && <p className="text-xs text-destructive mt-1">{errors.start_at.message as string}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">End</label>
                  <Input type="datetime-local" {...register('end_at')} className="rounded-xl" />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-950">Cover image</CardTitle>
          <CardDescription>Recommended: 1200×630px (16:9)</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="group relative aspect-[16/7.5] w-full max-w-3xl overflow-hidden rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 transition-all hover:bg-emerald-100/70">
            {coverUrl ? (
              <>
                <img src={coverUrl} alt="Cover Preview" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-4 transition-opacity">
                  <Button type="button" variant="secondary" className="rounded-xl" onClick={() => document.getElementById('cover-upload')?.click()}>Replace</Button>
                  <Button type="button" variant="destructive" className="rounded-xl" onClick={() => { setCoverFile(null); setCoverUrl(null); }}>Remove</Button>
                </div>
              </>
            ) : (
              <label htmlFor="cover-upload" className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer text-muted-foreground hover:text-foreground">
                <ImageIcon className="h-10 w-10 mb-2 opacity-50" />
                <span className="font-medium">Click to upload image</span>
                <span className="text-xs mt-1 opacity-70">Max 5MB</span>
              </label>
            )}
            <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'cover')} />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="h-fit rounded-3xl border-slate-200/80 bg-white shadow-none">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-950">Capacity & pricing</CardTitle>
            <CardDescription>Control attendance limits and whether payment is required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div>
              <label className="text-sm font-medium mb-1 block">Capacity</label>
              <Input type="number" {...register('capacity', { valueAsNumber: true })} className="rounded-xl" placeholder="Leave blank for unlimited" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Price (MYR)</label>
              <Input type="number" step="0.01" {...register('price', { valueAsNumber: true })} className="rounded-xl font-mono text-lg h-12" />
              <p className="text-xs text-muted-foreground mt-1.5">Set to 0 for a free event.</p>
              {errors.price && <p className="text-xs text-destructive mt-1">{errors.price.message as string}</p>}
            </div>
          </CardContent>
        </Card>

        {watchPrice > 0 && (
          <Card className="h-fit rounded-3xl border-amber-200 bg-amber-50/40 shadow-none animate-in fade-in slide-in-from-top-4 duration-300">
            <CardHeader className="pb-3 border-b border-amber-100 mb-4">
              <CardTitle className="text-amber-800 flex items-center gap-2"><QrCode className="h-5 w-5" /> Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-amber-100 shadow-sm text-sm text-amber-800 mb-4">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                <p>Payments are verified manually. Registrants will see this QR/link and upload proof of payment — you&apos;ll approve each registration from the Registrations tab.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-6">
                <div>
                  <label className="text-sm font-medium mb-1 block text-amber-900">Payment QR Code</label>
                  <div className="relative group w-full aspect-square border-2 border-dashed border-amber-200 rounded-xl bg-white overflow-hidden">
                    {qrUrl ? (
                      <>
                        <img src={qrUrl} alt="QR Preview" className="w-full h-full object-contain p-2" />
                        <label className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition-opacity">
                          <span className="text-white font-medium text-sm">Replace</span>
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'qr')} />
                        </label>
                      </>
                    ) : (
                      <label className="absolute inset-0 flex flex-col items-center justify-center cursor-pointer text-amber-700/50 hover:text-amber-700">
                        <Upload className="h-8 w-8 mb-2" />
                        <span className="text-xs font-medium text-center px-4">Upload DuitNow/TNG QR</span>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileSelect(e, 'qr')} />
                      </label>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block text-amber-900">Alternatively, Payment Link</label>
                    <Input {...register('payment_link')} className="rounded-xl border-amber-200 focus-visible:ring-amber-500" placeholder="https://..." />
                    {errors.payment_link && <p className="text-xs text-destructive mt-1">{errors.payment_link.message as string}</p>}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block text-amber-900">Instructions</label>
                    <Textarea 
                      {...register('payment_instructions')} 
                      className="rounded-xl border-amber-200 focus-visible:ring-amber-500 min-h-[100px]" 
                      placeholder="e.g. Please use your full name as the payment reference." 
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-950">Publish status</CardTitle>
          <CardDescription>Choose whether registration is private, open, or closed.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-col sm:flex-row gap-4">
                <div className="flex items-center space-x-2 border border-border p-4 rounded-xl flex-1 bg-card has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5 transition-colors">
                  <RadioGroupItem value="draft" id="draft" />
                  <label htmlFor="draft" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-foreground">Draft</div>
                    <div className="text-sm text-muted-foreground mt-1">Not visible to the public.</div>
                  </label>
                </div>
                <div className="flex items-center space-x-2 border border-border p-4 rounded-xl flex-1 bg-card has-[[data-state=checked]]:border-emerald-500 has-[[data-state=checked]]:bg-emerald-500/5 transition-colors">
                  <RadioGroupItem value="published" id="published" />
                  <label htmlFor="published" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-emerald-700">Published</div>
                    <div className="text-sm text-emerald-600/80 mt-1">Public page is live.</div>
                  </label>
                </div>
                <div className="flex items-center space-x-2 border border-border p-4 rounded-xl flex-1 bg-card has-[[data-state=checked]]:border-slate-500 has-[[data-state=checked]]:bg-slate-500/5 transition-colors">
                  <RadioGroupItem value="closed" id="closed" />
                  <label htmlFor="closed" className="flex-1 cursor-pointer">
                    <div className="font-semibold text-slate-700">Closed</div>
                    <div className="text-sm text-slate-500 mt-1">Registration closed.</div>
                  </label>
                </div>
              </RadioGroup>
            )}
          />
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-950">Automations</CardTitle>
          <CardDescription>Automatically trigger actions when someone registers.</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div>
            <label className="text-sm font-medium mb-1 block">Add to workflow</label>
            <Controller
              control={control}
              name="target_workflow_id"
              render={({ field }) => (
                <Select
                  value={field.value || 'none'}
                  onValueChange={(value) =>
                    field.onChange(value === 'none' ? null : value)
                  }
                >
                  <SelectTrigger className="h-11 w-full max-w-md rounded-xl bg-white">
                    <SelectValue placeholder="No workflow" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No workflow</SelectItem>
                    {workflows === undefined && (
                      <SelectItem value="no-workflows" disabled>
                        No workflows available
                      </SelectItem>
                    )}
                    {workflows?.map((w: {id: string; name: string}) => (
                      <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <p className="mt-2 text-xs text-muted-foreground">
              When a person registers, they will automatically be added to the first step of this workflow.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-3 z-20 mt-8 flex flex-col-reverse justify-end gap-3 rounded-2xl border border-slate-200 bg-white/92 p-3 shadow-[0_20px_55px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:flex-row">
        <Button variant="outline" type="button" onClick={() => window.history.back()} disabled={isSubmitting} className="h-10 rounded-xl px-5">
          Cancel
        </Button>
        <Button 
          variant="secondary" 
          type="button" 
          onClick={handleSubmit((data) => onSubmit(data, false))} 
          disabled={isSubmitting} 
          className="h-10 rounded-xl px-5 shadow-sm"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isEdit ? 'Save Changes' : 'Save Draft'}
        </Button>
        
        {watch('status') !== 'published' && (
          <Button 
            type="button" 
            onClick={handleSubmit((data) => onSubmit(data, true))} 
            disabled={isSubmitting} 
            className="h-10 rounded-xl bg-emerald-700 px-8 font-bold text-white shadow-sm hover:bg-emerald-800"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save & Publish
          </Button>
        )}
      </div>
    </div>
  );
}
