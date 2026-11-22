'use client';

// <!-- AGENT: FRONTEND -->
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CORE_FIELD_IDS, FIELD_TYPES, type FieldType, type FormField } from '@/lib/hg-link/formSchema';

const selectClass = 'h-11 w-full rounded-lg border border-input bg-background px-3 text-sm';

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text: 'Short text', textarea: 'Long text', email: 'Email', phone: 'Phone number', date: 'Date',
  dropdown: 'Dropdown', radio: 'Radio buttons', checkbox: 'Checkboxes', consent: 'Consent checkbox',
};

function slugify(label: string, taken: Set<string>): string {
  const base = label.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'option';
  let value = base;
  for (let n = 2; taken.has(value); n += 1) value = `${base}_${n}`;
  return value;
}

interface FieldEditorProps {
  field: FormField;
  onChange: (field: FormField) => void;
}

export function FieldEditor({ field, onChange }: FieldEditorProps) {
  const isCore = (CORE_FIELD_IDS as readonly string[]).includes(field.id);
  const isChoice = field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox';
  const labelsFixed = field.id === 'gender'; // values map to the People profile
  const id = (name: string) => `${field.id}-${name}`;

  // One option label per line. Existing values are kept so saved answers stay meaningful.
  const setOptionsFromText = (text: string) => {
    const labels = text.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 50);
    const taken = new Set<string>();
    const options = labels.map((label, index) => {
      const existing = field.options[index];
      const value = existing && existing.label === label ? existing.value : slugify(label, taken);
      taken.add(value);
      return { value, label };
    });
    onChange({ ...field, options });
  };

  return (
    <div className="space-y-3 border-t bg-muted/30 p-3">
      <div className="space-y-1.5">
        <Label htmlFor={id('label')}>Label</Label>
        <Input id={id('label')} value={field.label} maxLength={160} onChange={(e) => onChange({ ...field, label: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id('help')}>Help text (optional)</Label>
        <Input id={id('help')} value={field.helpText} maxLength={300} onChange={(e) => onChange({ ...field, helpText: e.target.value })} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id('type')}>Field type</Label>
        <select id={id('type')} className={selectClass} value={field.type} disabled={isCore}
          onChange={(e) => onChange({ ...field, type: e.target.value as FieldType, options: [], optionsSource: 'inline' })}>
          {FIELD_TYPES.map((t) => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
        </select>
        {isCore && <p className="text-xs text-muted-foreground">This field fills in the person&apos;s profile, so its type is fixed.</p>}
      </div>
      {isChoice && field.type === 'dropdown' && (
        <div className="space-y-1.5">
          <Label htmlFor={id('source')}>Options come from</Label>
          <select id={id('source')} className={selectClass} value={field.optionsSource}
            onChange={(e) => onChange({ ...field, optionsSource: e.target.value as FormField['optionsSource'] })}>
            <option value="inline">A list I type here</option>
            <option value="lists">Static lists in People (e.g. Connect Groups)</option>
          </select>
        </div>
      )}
      {isChoice && field.optionsSource === 'inline' && (
        <div className="space-y-1.5">
          <Label htmlFor={id('options')}>Options (one per line)</Label>
          <Textarea id={id('options')} rows={4} readOnly={labelsFixed} value={field.options.map((o) => o.label).join('\n')}
            onChange={(e) => setOptionsFromText(e.target.value)} />
          {labelsFixed && <p className="text-xs text-muted-foreground">Gender options are fixed to match People.</p>}
        </div>
      )}
    </div>
  );
}
