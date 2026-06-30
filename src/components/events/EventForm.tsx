'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Event } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Loader2, Image as ImageIcon, QrCode, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { marked } from 'marked';
import { cn } from '@/lib/utils';

interface EventFormProps {
  event?: Event;
}

const eventSchema = z.object({
  name: z.string().min(1, 'Event name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().optional(),
  location: z.string().optional(),
  start_at: z.string().min(1, 'Start date/time is required'),
  end_at: z.string().optional(),
  capacity: z.number().nullable().optional(),
  price: z.number().min(0, 'Price must be 0 or greater'),
  payment_link: z.string().url('Must be a valid URL').or(z.literal('')).optional(),
  payment_instructions: z.string().optional(),
  status: z.enum(['draft', 'published', 'closed']),
});

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')       // Replace spaces with -
    .replace(/[^\w\-]+/g, '')   // Remove all non-word chars
    .replace(/\-\-+/g, '-');    // Replace multiple - with single -
}

export function EventForm({ event }: EventFormProps) {
  const router = useRouter();
  const isEdit = !!event;

  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://people.harvestgen.org';

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverUrl, setCoverUrl] = useState(event?.cover_image_url || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [qrUrl, setQrUrl] = useState(event?.payment_qr_url || null);
  const [qrFile, setQrFile] = useState<File | null>(null);

  // Format datetimes for input type="datetime-local" (YYYY-MM-DDThh:mm)
  const formatDatetimeForInput = (dateString?: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      name: event?.name || '',
      slug: event?.slug || '',
      description: event?.description || '',
      location: event?.location || '',
      start_at: formatDatetimeForInput(event?.start_at) || '',
      end_at: formatDatetimeForInput(event?.end_at) || '',
      capacity: event?.capacity || null,
      price: event?.price || 0,
      payment_link: event?.payment_link || '',
      payment_instructions: event?.payment_instructions || '',
      status: event?.status || 'draft',
    }
  });

  const watchName = watch('name');
  const watchSlug = watch('slug');
  const watchPrice = watch('price');
  const watchDescription = watch('description');

  // Auto-generate slug when name changes (only in create mode or if slug is empty)
  useEffect(() => {
    if (!isEdit && watchName && !watchSlug) {
      setValue('slug', slugify(watchName), { shouldValidate: true });
    }
  }, [watchName, isEdit, watchSlug, setValue]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, type: 'cover' | 'qr') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error('File size must be less than 5MB');
        return;
      }
      if (type === 'cover') {
        setCoverFile(file);
        setCoverUrl(URL.createObjectURL(file));
      } else {
        setQrFile(file);
        setQrUrl(URL.createObjectURL(file));
      }
    }
  };

  const uploadImage = async (eventId: string, file: File, type: 'cover' | 'qr') => {
    const formData = new FormData();
    formData.append('file', file);
    
    const res = await fetch(`/api/admin/events/${eventId}/${type}`, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) throw new Error(`Failed to upload ${type}`);
    const { data } = await res.json();
    return data.url; // Assuming backend returns { data: { url: string } }
  };

  const onSubmit = async (data: any, forcePublish = false) => {
    setIsSubmitting(true);
    try {
      if (forcePublish) {
        data.status = 'published';
      }

      // Convert capacity from empty string to null
      if (data.capacity === '') data.capacity = null;
      if (data.end_at === '') data.end_at = null;
      if (data.payment_link === '') data.payment_link = null;

      // Ensure start_at and end_at are proper ISO strings with timezone info
      // Browser's datetime-local gives YYYY-MM-DDTHH:mm. We append Z or parse it to Date
      data.start_at = new Date(data.start_at).toISOString();
      if (data.end_at) {
        data.end_at = new Date(data.end_at).toISOString();
      }

      const url = isEdit ? `/api/admin/events/${event.id}` : '/api/admin/events';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save event');
      }

      const { data: responseData } = await res.json();
      const eventId = responseData.id;

      // Upload images if changed
      if (coverFile) await uploadImage(eventId, coverFile, 'cover');
      if (qrFile && watchPrice > 0) await uploadImage(eventId, qrFile, 'qr');

      if (forcePublish) {
        toast.success('Event published successfully!');
        router.push('/events');
      } else {
        toast.success(isEdit ? 'Event updated successfully' : 'Event created successfully');
        if (!isEdit) {
          router.push(`/events/${eventId}/edit`);
        } else {
          router.refresh();
        }
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader>
          <CardTitle>Basic Information</CardTitle>
          <CardDescription>Core details about the event.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Event Name <span className="text-red-500">*</span></label>
              <Input {...register('name')} className="rounded-xl text-lg font-medium h-12" placeholder="e.g. Youth Camp 2026" />
              {errors.name && <p className="text-xs text-destructive mt-1">{errors.name.message as string}</p>}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Public URL Slug <span className="text-red-500">*</span></label>
              <div className="flex items-center">
                <span className="bg-muted px-3 border border-r-0 border-input rounded-l-xl h-10 flex items-center text-sm text-muted-foreground">
                  people.harvestgen.org/e/
                </span>
                <Input {...register('slug')} className="rounded-l-none rounded-r-xl" placeholder="youth-camp-2026" />
              </div>
              {errors.slug && <p className="text-xs text-destructive mt-1">{errors.slug.message as string}</p>}
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Tabs defaultValue="write" className="w-full border border-input rounded-xl overflow-hidden">
                <div className="bg-muted px-3 py-2 border-b border-input flex items-center justify-between">
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
                    <div dangerouslySetInnerHTML={{ __html: marked.parse(watchDescription) }} />
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

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader>
          <CardTitle>Cover Image</CardTitle>
          <CardDescription>Recommended: 1200×630px (16:9)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative group w-full aspect-[16/9] max-w-2xl border-2 border-dashed border-border rounded-xl bg-muted overflow-hidden transition-all hover:bg-muted/80">
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

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="rounded-2xl border-border shadow-sm h-fit">
          <CardHeader>
            <CardTitle>Capacity & Pricing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          <Card className="rounded-2xl border-amber-200 bg-amber-50/30 shadow-sm h-fit animate-in fade-in slide-in-from-top-4 duration-300">
            <CardHeader className="pb-3 border-b border-amber-100 mb-4">
              <CardTitle className="text-amber-800 flex items-center gap-2"><QrCode className="h-5 w-5" /> Payment Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-white rounded-xl border border-amber-100 shadow-sm text-sm text-amber-800 mb-4">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
                <p>Payments are verified manually. Registrants will see this QR/link and upload proof of payment — you'll approve each registration from the Registrations tab.</p>
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

      <Card className="rounded-2xl border-border shadow-sm">
        <CardHeader>
          <CardTitle>Publish Status</CardTitle>
        </CardHeader>
        <CardContent>
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

      <div className="flex justify-end gap-3 pt-4 border-t border-border mt-8">
        <Button variant="outline" type="button" onClick={() => router.back()} disabled={isSubmitting} className="rounded-xl">
          Cancel
        </Button>
        <Button 
          variant="secondary" 
          type="button" 
          onClick={handleSubmit((data) => onSubmit(data, false))} 
          disabled={isSubmitting} 
          className="rounded-xl shadow-sm"
        >
          {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {isEdit ? 'Save Changes' : 'Save Draft'}
        </Button>
        
        {watch('status') !== 'published' && (
          <Button 
            type="button" 
            onClick={handleSubmit((data) => onSubmit(data, true))} 
            disabled={isSubmitting} 
            className="rounded-xl shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white px-8"
          >
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save & Publish
          </Button>
        )}
      </div>
    </div>
  );
}
