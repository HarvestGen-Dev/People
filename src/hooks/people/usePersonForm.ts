import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { PersonWithRelations, FieldDefinition } from '@/lib/types';

export const personSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').or(z.literal('')),
  phone: z.string().optional(),
  gender: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  birthdate: z.string().optional(),
  marital_status: z.string().optional(),
  anniversary: z.string().optional(),
  campus: z.string().optional(),
  household_id: z.string().optional().nullable(),
});

export type PersonFormData = z.infer<typeof personSchema>;

export function usePersonForm(
  person: PersonWithRelations | undefined,
  fieldDefinitions: FieldDefinition[]
) {
  const router = useRouter();
  const isEdit = !!person;
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    person?.person_tags?.map(pt => pt.tag_id) || []
  );
  
  const [customFields, setCustomFields] = useState(() => 
    fieldDefinitions.map(def => {
      const existing = person?.person_field_values?.find(val => val.field_definition_id === def.id);
      return { field_definition_id: def.id, value: existing?.value || '' };
    })
  );

  const [householdName, setHouseholdName] = useState('');
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false);
  const [householdSearchOpen, setHouseholdSearchOpen] = useState(false);
  
  const [photoUrl, setPhotoUrl] = useState(person?.photo_url || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const form = useForm<PersonFormData>({
    resolver: zodResolver(personSchema),
    defaultValues: {
      first_name: person?.first_name || '',
      last_name: person?.last_name || '',
      email: person?.email || '',
      phone: person?.phone || '',
      gender: person?.gender || '',
      status: person?.status || 'visitor',
      birthdate: person?.birthdate || '',
      marital_status: person?.marital_status || '',
      anniversary: person?.anniversary || '',
      campus: person?.campus || 'Bandar Sunway',
      household_id: person?.household_id || null,
    }
  });

  const toggleTag = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleCustomFieldChange = (id: string, value: string) => {
    setCustomFields(prev => prev.map(f => f.field_definition_id === id ? { ...f, value } : f));
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) {
        toast.error('File size must be less than 2MB');
        return;
      }
      setPhotoFile(file);
      setPhotoUrl(URL.createObjectURL(file));
    }
  };

  const uploadPhoto = async (personId: string) => {
    if (!photoFile) return photoUrl;
    const formData = new FormData();
    formData.append('file', photoFile);
    
    const res = await fetch(`/api/admin/people/${personId}/photo`, {
      method: 'POST',
      body: formData,
    });
    
    if (!res.ok) throw new Error('Failed to upload photo');
    const { data } = await res.json();
    return data.photo_url;
  };

  const onSubmit = async (data: PersonFormData) => {
    setIsSubmitting(true);
    try {
      const cleanedPerson = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === '' ? null : value,
        ])
      );

      const payload = {
        person: cleanedPerson,
        tags: selectedTags,
        customFields,
        household_name: householdName ? householdName : undefined,
      };

      const url = isEdit ? `/api/admin/people/${person.id}` : '/api/admin/people';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to save person');
      }

      const { data: responseData } = await res.json();
      const personId = responseData.id;

      if (photoFile) {
        await uploadPhoto(personId);
      }

      toast.success(isEdit ? 'Person updated successfully' : 'Person created successfully');
      router.push(`/people/${personId}`);
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save person');
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    form,
    isEdit,
    isSubmitting,
    selectedTags,
    toggleTag,
    customFields,
    handleCustomFieldChange,
    householdName,
    setHouseholdName,
    isCreatingHousehold,
    setIsCreatingHousehold,
    householdSearchOpen,
    setHouseholdSearchOpen,
    photoUrl,
    setPhotoUrl,
    photoFile,
    setPhotoFile,
    handlePhotoSelect,
    onSubmit,
  };
}
