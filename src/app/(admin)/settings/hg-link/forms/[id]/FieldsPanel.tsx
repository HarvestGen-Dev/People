'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CORE_FIELD_IDS, FIELD_TYPES, type FieldType, type FormDefinition, type FormField } from '@/lib/hg-link/formSchema';
import { ConfirmDialog } from '../../ConfirmDialog';
import { FIELD_TYPE_LABELS, FieldEditor } from './FieldEditor';

interface FieldsPanelProps {
  definition: FormDefinition;
  onChange: (next: FormDefinition) => void;
}

export function FieldsPanel({ definition, onChange }: FieldsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FormField | null>(null);
  const [newType, setNewType] = useState<FieldType>('text');
  const [announcement, setAnnouncement] = useState('');
  const fields = definition.fields;
  const setFields = (next: FormField[]) => onChange({ ...definition, fields: next });
  const update = (field: FormField) => setFields(fields.map((f) => (f.id === field.id ? field : f)));
  const isCore = (id: string) => (CORE_FIELD_IDS as readonly string[]).includes(id);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= fields.length) return;
    const next = [...fields];
    [next[index], next[target]] = [next[target], next[index]];
    setFields(next);
    setAnnouncement(`${fields[index].label} moved to position ${target + 1} of ${fields.length}`);
  };
  const add = () => {
    const field: FormField = {
      id: `field_${Math.random().toString(36).slice(2, 8)}`, type: newType, label: 'New question', helpText: '',
      required: false, hidden: false, options: [], optionsSource: 'inline',
    };
    setFields([...fields, field]);
    setEditingId(field.id);
  };

  return (
    <section aria-labelledby="fields-heading" className="space-y-3 rounded-xl border bg-card p-4">
      <h2 id="fields-heading" className="text-base font-semibold">Questions</h2>
      <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      <ul className="space-y-2">
        {fields.map((field, index) => (
          <li key={field.id} className="rounded-lg border">
            <div className="flex flex-wrap items-center gap-2 p-2">
              <span className="min-w-0 flex-1 basis-40">
                <span className={`block truncate text-sm font-medium ${field.hidden ? 'text-muted-foreground line-through' : ''}`}>{field.label}</span>
                <span className="block text-xs text-muted-foreground">{FIELD_TYPE_LABELS[field.type]}{field.required ? ' · required' : ''}</span>
              </span>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={field.required} aria-label={`${field.label} is required`} onCheckedChange={(required) => update({ ...field, required })} /> Required
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={!field.hidden} aria-label={`Show ${field.label}`} onCheckedChange={(show) => update({ ...field, hidden: !show })} /> Shown
              </label>
              <Button size="icon" variant="ghost" aria-label={`Move ${field.label} up`} disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp /></Button>
              <Button size="icon" variant="ghost" aria-label={`Move ${field.label} down`} disabled={index === fields.length - 1} onClick={() => move(index, 1)}><ArrowDown /></Button>
              <Button size="icon" variant="ghost" aria-label={`Edit ${field.label}`} aria-expanded={editingId === field.id}
                onClick={() => setEditingId(editingId === field.id ? null : field.id)}><Pencil /></Button>
              {!isCore(field.id) && <Button size="icon" variant="ghost" aria-label={`Delete ${field.label}`} onClick={() => setDeleting(field)}><Trash2 /></Button>}
            </div>
            {editingId === field.id && <FieldEditor field={field} onChange={update} />}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="new-field-type" className="sr-only">New question type</label>
        <select id="new-field-type" className="h-11 rounded-lg border border-input bg-background px-3 text-sm" value={newType} onChange={(e) => setNewType(e.target.value as FieldType)}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
        </select>
        <Button variant="outline" onClick={add}><Plus /> Add question</Button>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        title={`Delete “${deleting?.label ?? ''}”?`}
        description="Removed from your draft. Answers already collected stay with their submissions."
        confirmLabel="Delete question"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => { if (deleting) setFields(fields.filter((f) => f.id !== deleting.id)); setDeleting(null); }}
      />
    </section>
  );
}
