import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Event } from '@/lib/types';

export const eventSchema = z.object({
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
  target_workflow_id: z.string().nullable().optional(),
});

export type EventFormData = z.infer<typeof eventSchema>;

function slugify(text: string) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')       // Replace spaces with -
    .replace(/[^\w-]+/g, '')   // Remove all non-word chars
    .replace(/--+/g, '-');    // Replace multiple - with single -
}

export function useEventForm(event?: Event) {
  const router = useRouter();
  const isEdit = !!event;

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [coverUrl, setCoverUrl] = useState(event?.cover_image_url || null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [qrUrl, setQrUrl] = useState(event?.payment_qr_url || null);
  const [qrFile, setQrFile] = useState<File | null>(null);

  const formatDatetimeForInput = (dateString?: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const tzOffset = date.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    return localISOTime;
  };

  const form = useForm<EventFormData>({
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
      target_workflow_id: event?.target_workflow_id || null,
    }
  });

  const { watch, setValue } = form;
  const watchName = watch('name');
  const watchSlug = watch('slug');
  const watchPrice = watch('price');

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
    return data.url;
  };

  const onSubmit = async (data: EventFormData, forcePublish = false) => {
    setIsSubmitting(true);
    try {
      const payload = {
        ...data,
        status: forcePublish ? 'published' : data.status,
        capacity: data.capacity ?? null,
        end_at: data.end_at
          ? new Date(data.end_at).toISOString()
          : null,
        payment_link: data.payment_link || null,
        start_at: new Date(data.start_at).toISOString(),
        target_workflow_id: data.target_workflow_id === 'none' ? null : data.target_workflow_id || null,
      };

      const url = isEdit ? `/api/admin/events/${event.id}` : '/api/admin/events';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save event');
      }

      const { data: responseData } = await res.json();
      const eventId = responseData.id;

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
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save event');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    isEdit,
    isSubmitting,
    coverUrl,
    setCoverUrl,
    coverFile,
    setCoverFile,
    qrUrl,
    setQrUrl,
    qrFile,
    setQrFile,
    handleFileSelect,
    onSubmit,
  };
}
