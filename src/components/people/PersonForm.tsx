'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { PersonWithRelations, Tag, FieldDefinition, Household } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown, X, Upload, Loader2, Camera } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface PersonFormProps {
  person?: PersonWithRelations;
  tags: Tag[];
  fieldDefinitions: FieldDefinition[];
  households: Household[];
}

const personSchema = z.object({
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

type PersonFormData = z.infer<typeof personSchema>;

export function PersonForm({ person, tags, fieldDefinitions, households }: PersonFormProps) {
  const router = useRouter();
  const isEdit = !!person;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(
    person?.person_tags?.map(pt => pt.tag_id) || []
  );
  
  // Custom fields state
  const initialCustomFields = fieldDefinitions.map(def => {
    const existing = person?.person_field_values?.find(val => val.field_definition_id === def.id);
    return { field_definition_id: def.id, value: existing?.value || '' };
  });
  const [customFields, setCustomFields] = useState(initialCustomFields);

  // Household inline creation state
  const [householdName, setHouseholdName] = useState('');
  const [isCreatingHousehold, setIsCreatingHousehold] = useState(false);
  const [householdSearchOpen, setHouseholdSearchOpen] = useState(false);
  
  // Photo state
  const [photoUrl, setPhotoUrl] = useState(person?.photo_url || null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  const { register, handleSubmit, formState: { errors }, watch, control, setValue } = useForm<PersonFormData>({
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

  const maritalStatus = watch('marital_status');
  const selectedHouseholdId = watch('household_id');

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
      // Clean up empty strings
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 [&_[data-slot=input]]:h-11 [&_[data-slot=input]]:rounded-xl [&_[data-slot=select-trigger]]:h-11 [&_[data-slot=select-trigger]]:rounded-xl">
      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-950">Basic information</CardTitle>
          <CardDescription>Essential details about this person.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="relative group">
              <div className="relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50">
                {photoUrl ? (
                  <img src={photoUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-muted-foreground/50" />
                )}
                <label className="absolute inset-0 bg-black/40 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Upload className="h-5 w-5 mb-1" />
                  <span className="text-xs font-medium">Upload</span>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoSelect} />
                </label>
              </div>
              {photoUrl && (
                <button type="button" onClick={() => { setPhotoFile(null); setPhotoUrl(null); }} className="text-xs text-destructive mt-2 w-full text-center hover:underline">
                  Remove photo
                </button>
              )}
            </div>
            
            <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium mb-1 block">First Name <span className="text-red-500">*</span></label>
                <Input {...register('first_name')} className="rounded-xl" />
                {errors.first_name && <p className="text-xs text-destructive mt-1">{errors.first_name.message as string}</p>}
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Last Name <span className="text-red-500">*</span></label>
                <Input {...register('last_name')} className="rounded-xl" />
                {errors.last_name && <p className="text-xs text-destructive mt-1">{errors.last_name.message as string}</p>}
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Email</label>
              <Input type="email" {...register('email')} className="rounded-xl" />
              {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message as string}</p>}
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Phone</label>
              <Input {...register('phone')} className="rounded-xl" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Gender</label>
              <Controller
                control={control}
                name="gender"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Status <span className="text-red-500">*</span></label>
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="visitor">Visitor</SelectItem>
                      <SelectItem value="active">Active Member</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.status && <p className="text-xs text-destructive mt-1">{errors.status.message as string}</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border-slate-200/80 bg-white shadow-none">
        <CardHeader className="border-b border-slate-100">
          <CardTitle className="text-lg font-bold text-slate-950">Additional details</CardTitle>
          <CardDescription>Information that helps teams understand and serve this person well.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Birthdate</label>
            <Input type="date" {...register('birthdate')} className="rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Campus</label>
            <Input {...register('campus')} className="rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Marital Status</label>
            <Controller
              control={control}
              name="marital_status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">Single</SelectItem>
                    <SelectItem value="married">Married</SelectItem>
                    <SelectItem value="divorced">Divorced</SelectItem>
                    <SelectItem value="widowed">Widowed</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          {maritalStatus === 'married' && (
            <div>
              <label className="text-sm font-medium mb-1 block">Anniversary</label>
              <Input type="date" {...register('anniversary')} className="rounded-xl" />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="h-fit rounded-3xl border-slate-200/80 bg-white shadow-none">
          <CardHeader className="border-b border-slate-100">
            <CardTitle className="text-lg font-bold text-slate-950">Household & tags</CardTitle>
            <CardDescription>Connect this person to their family and ministry context.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div>
              <label className="text-sm font-medium mb-1 block">Household</label>
              <Popover open={householdSearchOpen} onOpenChange={setHouseholdSearchOpen}>
                <PopoverTrigger className="inline-flex items-center whitespace-nowrap text-sm font-medium h-9 px-4 py-2 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground w-full justify-between rounded-xl">
                  {householdName ? `New: ${householdName}` : selectedHouseholdId ? households.find(h => h.id === selectedHouseholdId)?.name : 'Select household...'}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[min(300px,calc(100vw-2rem))] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search households..." />
                    <CommandList>
                      <CommandEmpty>
                        {!isCreatingHousehold ? (
                          <div className="p-4 text-center">
                            <p className="text-sm text-muted-foreground mb-3">No household found.</p>
                            <Button size="sm" variant="outline" onClick={() => setIsCreatingHousehold(true)}>Create new household</Button>
                          </div>
                        ) : (
                          <div className="p-4 space-y-3">
                            <Input placeholder="Enter household name..." value={householdName} onChange={e => setHouseholdName(e.target.value)} />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => { setValue('household_id', null); setHouseholdSearchOpen(false); setIsCreatingHousehold(false); }} className="w-full">Create & Select</Button>
                              <Button size="sm" variant="ghost" onClick={() => setIsCreatingHousehold(false)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </CommandEmpty>
                      <CommandGroup>
                        {households.map(h => (
                          <CommandItem key={h.id} value={h.name} onSelect={() => { setValue('household_id', h.id); setHouseholdName(''); setHouseholdSearchOpen(false); }}>
                            <Check className={cn("mr-2 h-4 w-4", selectedHouseholdId === h.id ? "opacity-100" : "opacity-0")} />
                            {h.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">Tags</label>
              <Popover>
                <PopoverTrigger className="inline-flex items-center whitespace-nowrap text-sm font-medium h-9 px-4 py-2 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground w-full justify-between rounded-xl">
                  Select tags... <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </PopoverTrigger>
                <PopoverContent className="w-[min(300px,calc(100vw-2rem))] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search tags..." />
                    <CommandList>
                      <CommandEmpty>No tags found.</CommandEmpty>
                      <CommandGroup>
                        {tags.map(tag => (
                          <CommandItem key={tag.id} value={tag.name} onSelect={() => toggleTag(tag.id)}>
                            <div className={cn("mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary", selectedTags.includes(tag.id) ? "bg-primary text-primary-foreground" : "opacity-50 [&_svg]:invisible")}>
                              <Check className="h-4 w-4" />
                            </div>
                            <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: tag.color }} />
                            {tag.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedTags.map(tagId => {
                  const tag = tags.find(t => t.id === tagId);
                  if (!tag) return null;
                  return (
                    <Badge key={tag.id} style={{ backgroundColor: tag.color + '20', color: tag.color, borderColor: tag.color + '40' }} className="border shadow-none py-1 gap-1">
                      {tag.name}
                      <X className="h-3 w-3 cursor-pointer opacity-70 hover:opacity-100" onClick={() => toggleTag(tag.id)} />
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {fieldDefinitions.length > 0 && (
          <Card className="h-fit rounded-3xl border-slate-200/80 bg-white shadow-none">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-lg font-bold text-slate-950">Custom fields</CardTitle>
              <CardDescription>Church-specific information configured by your administrators.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 pt-6">
              {fieldDefinitions.map(def => {
                const valObj = customFields.find(f => f.field_definition_id === def.id);
                const value = valObj?.value || '';
                
                return (
                  <div key={def.id}>
                    <label className="text-sm font-medium mb-1 block">
                      {def.name} {def.is_required && <span className="text-red-500">*</span>}
                    </label>
                    {def.field_type === 'boolean' ? (
                      <Switch 
                        checked={value === 'true'} 
                        onCheckedChange={(c) => handleCustomFieldChange(def.id, c ? 'true' : 'false')} 
                      />
                    ) : def.field_type === 'select' ? (
                      <Select value={value} onValueChange={(v) => handleCustomFieldChange(def.id, v || '')}>
                        <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select option" /></SelectTrigger>
                        <SelectContent>
                          {def.options?.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : def.field_type === 'date' ? (
                      <Input type="date" value={value} onChange={e => handleCustomFieldChange(def.id, e.target.value)} className="rounded-xl" />
                    ) : def.field_type === 'number' ? (
                      <Input type="number" value={value} onChange={e => handleCustomFieldChange(def.id, e.target.value)} className="rounded-xl" />
                    ) : (
                      <Input type="text" value={value} onChange={e => handleCustomFieldChange(def.id, e.target.value)} className="rounded-xl" />
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="sticky bottom-3 z-20 flex flex-col-reverse justify-end gap-3 rounded-2xl border border-slate-200 bg-white/92 p-3 shadow-[0_20px_55px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:flex-row">
        <Button variant="outline" type="button" onClick={() => router.back()} disabled={isSubmitting} className="h-10 rounded-xl px-5">
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting} className="h-10 rounded-xl bg-emerald-700 px-8 font-bold shadow-sm hover:bg-emerald-800">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isEdit ? 'Save Changes' : 'Create Person'}
        </Button>
      </div>
    </form>
  );
}
