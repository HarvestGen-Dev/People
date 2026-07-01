'use client';

import { useState } from 'react';
import { FieldDefinition } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Edit2, Trash2, GripVertical, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableFieldRow({ field, onEdit, onDelete }: { field: FieldDefinition, onEdit: (f: FieldDefinition) => void, onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-4 p-4 bg-white border border-border rounded-xl shadow-sm mb-3 group">
      <div {...attributes} {...listeners} className="cursor-grab text-slate-400 hover:text-slate-600 focus:outline-none">
        <GripVertical className="h-5 w-5" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-medium text-slate-900 truncate">{field.name}</span>
          {field.is_required && <span className="bg-red-50 text-red-600 text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Required</span>}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="bg-slate-100 px-2 py-0.5 rounded font-mono text-[10px] uppercase text-slate-600 border border-slate-200">
            {field.field_type}
          </span>
          <span className="truncate max-w-[200px]">Slug: {field.slug}</span>
          {field.field_type === 'select' && field.options && (
            <span className="truncate max-w-[200px]">Options: {field.options.join(', ')}</span>
          )}
        </div>
      </div>
      
      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-primary" onClick={() => onEdit(field)}>
          <Edit2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-destructive/10" onClick={() => onDelete(field.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function FieldsManager({ initialFields, churchId }: { initialFields: FieldDefinition[], churchId: string }) {
  const [fields, setFields] = useState<FieldDefinition[]>(initialFields);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState<{name: string, slug: string, field_type: string, is_required: boolean, options: string[]}>({
    name: '', slug: '', field_type: 'text', is_required: false, options: []
  });
  const [newOption, setNewOption] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        const newArray = arrayMove(items, oldIndex, newIndex);
        
        // Save new order to backend
        fetch('/api/admin/fields/reorder', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: newArray.map(f => f.id) })
        }).catch(err => toast.error('Failed to save new order'));

        return newArray;
      });
    }
  };

  const openCreate = () => {
    setFormData({ name: '', slug: '', field_type: 'text', is_required: false, options: [] });
    setNewOption('');
    setEditingId(null);
    setIsDialogOpen(true);
  };

  const openEdit = (field: FieldDefinition) => {
    setFormData({
      name: field.name,
      slug: field.slug,
      field_type: field.field_type,
      is_required: field.is_required,
      options: field.options || []
    });
    setNewOption('');
    setEditingId(field.id);
    setIsDialogOpen(true);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    if (!editingId && name) {
      const slug = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      setFormData({ ...formData, name, slug });
    } else {
      setFormData({ ...formData, name });
    }
  };

  const addOption = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (newOption.trim() && !formData.options.includes(newOption.trim())) {
        setFormData({ ...formData, options: [...formData.options, newOption.trim()] });
        setNewOption('');
      }
    }
  };

  const removeOption = (opt: string) => {
    setFormData({ ...formData, options: formData.options.filter(o => o !== opt) });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error('Name and slug are required');
      return;
    }
    if (formData.field_type === 'select' && formData.options.length === 0) {
      toast.error('Select fields must have at least one option');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingId ? `/api/admin/fields/${editingId}` : '/api/admin/fields';
      const method = editingId ? 'PATCH' : 'POST';

      const payload = {
        ...formData,
        options: formData.field_type === 'select' ? formData.options : null
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to save custom field');
      const { data } = await res.json();

      if (editingId) {
        setFields(fields.map(f => f.id === editingId ? { ...f, ...data } : f));
        toast.success('Field updated');
      } else {
        setFields([...fields, data]);
        toast.success('Field created');
      }
      setIsDialogOpen(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to save custom field');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this custom field? All data associated with this field will be lost.')) return;
    try {
      const res = await fetch(`/api/admin/fields/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete field');
      setFields(fields.filter(f => f.id !== id));
      toast.success('Field deleted');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete custom field');
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <p className="text-sm text-slate-500">Drag to reorder fields.</p>
        <Button onClick={openCreate} className="rounded-xl shadow-sm bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> New field
        </Button>
      </div>

      <div className="bg-slate-50 p-4 rounded-2xl border border-border min-h-[300px]">
        {fields.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            No custom fields defined yet.
          </div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
              {fields.map(field => (
                <SortableFieldRow key={field.id} field={field} onEdit={openEdit} onDelete={handleDelete} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit Custom Field' : 'New Custom Field'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 py-2">
            <div>
              <label className="text-sm font-medium mb-1 block">Field Name</label>
              <Input value={formData.name} onChange={handleNameChange} placeholder="e.g. T-Shirt Size" className="rounded-xl" />
            </div>
            
            <div>
              <label className="text-sm font-medium mb-1 block">Database Slug</label>
              <Input value={formData.slug} onChange={e => setFormData({ ...formData, slug: e.target.value })} className="rounded-xl font-mono text-sm" placeholder="t_shirt_size" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Type</label>
                <Select value={formData.field_type} onValueChange={(v) => setFormData({ ...formData, field_type: v || 'text' })}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="boolean">Boolean (Switch)</SelectItem>
                    <SelectItem value="select">Select (Dropdown)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Required</label>
                <div className="flex items-center h-10">
                  <Switch checked={formData.is_required} onCheckedChange={(c) => setFormData({ ...formData, is_required: c })} />
                </div>
              </div>
            </div>

            {formData.field_type === 'select' && (
              <div className="p-4 bg-slate-50 border border-border rounded-xl space-y-3">
                <label className="text-sm font-medium block">Options</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.options.map(opt => (
                    <div key={opt} className="bg-white border border-border text-sm px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                      {opt}
                      <button type="button" onClick={() => removeOption(opt)} className="text-slate-400 hover:text-destructive"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
                <Input 
                  value={newOption} 
                  onChange={e => setNewOption(e.target.value)} 
                  onKeyDown={addOption} 
                  placeholder="Type option and press Enter..." 
                  className="rounded-lg h-9 text-sm"
                />
              </div>
            )}

            <DialogFooter className="pt-4 border-t border-border mt-6">
              <Button type="button" variant="ghost" onClick={() => setIsDialogOpen(false)} className="rounded-xl">Cancel</Button>
              <Button type="submit" disabled={isSubmitting} className="rounded-xl shadow-sm">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingId ? 'Save changes' : 'Create field'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
