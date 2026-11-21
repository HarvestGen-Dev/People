'use client';

// <!-- AGENT: FRONTEND -->
import { useState } from 'react';
import type { FormDefinition, FormField, ResolvedOptions, FieldErrors } from '@/lib/hg-link/formSchema';
import { validateSubmission } from '@/lib/hg-link/formSchema';
import { cn } from '@/lib/utils';

type Values = Record<string, string | string[] | boolean>;

interface HgLinkFormProps {
  definition: FormDefinition;
  options: ResolvedOptions;
  /** Where to POST. Omit with preview=true. */
  submitPath?: string;
  preview?: boolean;
}

const inputClass =
  'mt-1.5 block min-h-11 w-full min-w-0 rounded-md border border-[#8b7d72] bg-[#fdf6ef] px-3 py-2.5 text-base text-[#3a3a3a] focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[#344f66] aria-[invalid=true]:border-[#b42318]';
const choiceClass = 'flex min-h-11 cursor-pointer items-center gap-3 py-1 font-normal';
const boxClass = 'size-5 shrink-0 accent-[#344f66]';

export function HgLinkForm({ definition, options, submitPath, preview = false }: HgLinkFormProps) {
  // One key per page load: a double-click or retry replays instead of duplicating.
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState<Values>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const fields = definition.fields.filter((f) => !f.hidden);
  const set = (id: string, value: string | string[] | boolean) => {
    setValues((v) => ({ ...v, [id]: value }));
    setErrors((e) => (e[id] ? { ...e, [id]: '' } : e));
  };

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    setFormError(null);
    const check = validateSubmission(definition, options, values);
    if (!check.ok) {
      setErrors(check.errors);
      const first = Object.keys(check.errors)[0];
      document.getElementById(`hg-field-${first}`)?.focus();
      return;
    }
    if (preview || !submitPath) {
      setDone(true);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(submitPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ values }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; fields?: FieldErrors } | null;
      if (!response.ok) {
        if (result?.fields) setErrors(result.fields);
        throw new Error(result?.error || 'We could not send your details. Please try again.');
      }
      setDone(true);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'We could not send your details. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <div role="status" className="rounded-[1.15rem] border border-[#e0d4c9] bg-[#f7e6da] p-6 text-lg">
        {definition.successMessage}
        {preview && <p className="mt-2 text-sm text-[#625a53]">Preview only. Nothing was sent.</p>}
      </div>
    );
  }

  return (
    <form noValidate onSubmit={onSubmit} className="grid gap-5 rounded-[1.15rem] border border-[#e0d4c9] bg-[#fffaf5] p-4 sm:p-8">
      {fields.map((field) => (
        <FieldControl key={field.id} field={field} options={options} value={values[field.id]} error={errors[field.id]} onChange={(v) => set(field.id, v)} />
      ))}
      {definition.privacyNote && <p className="text-sm text-[#625a53]">{definition.privacyNote}</p>}
      {formError && <p role="alert" className="rounded-md bg-[#fde8e6] p-3 text-[#7a271a]">{formError}</p>}
      <button
        type="submit"
        disabled={submitting}
        className="min-h-11 rounded-full border border-[#344f66] bg-[#344f66] px-5 py-2.5 font-semibold text-[#fdf6ef] hover:bg-[#243a4d] focus-visible:outline-[3px] focus-visible:outline-offset-4 focus-visible:outline-[#344f66] disabled:opacity-60 max-sm:w-full sm:justify-self-start"
      >
        {submitting ? 'Sending…' : definition.submitLabel}
      </button>
    </form>
  );
}

function FieldControl({ field, options, value, error, onChange }: {
  field: FormField;
  options: ResolvedOptions;
  value: string | string[] | boolean | undefined;
  error?: string;
  onChange: (value: string | string[] | boolean) => void;
}) {
  const id = `hg-field-${field.id}`;
  const describedBy = [field.helpText ? `${id}-help` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined;
  const choices = field.optionsSource === 'lists' ? options[field.id] ?? [] : field.options;
  const requiredMark = field.required ? undefined : <span className="font-normal text-[#625a53]"> (optional)</span>;
  const meta = (
    <>
      {field.helpText && <span id={`${id}-help`} className="mt-0.5 block text-sm font-normal text-[#625a53]">{field.helpText}</span>}
      {error && <span id={`${id}-error`} className="mt-1 block text-sm font-semibold text-[#b42318]">{error}</span>}
    </>
  );

  if (field.type === 'consent' || (field.type === 'checkbox' && choices.length === 0)) {
    return (
      <div>
        <label className={cn(choiceClass, 'font-semibold')}>
          <input id={id} type="checkbox" className={boxClass} checked={value === true} aria-invalid={Boolean(error)} aria-describedby={describedBy}
            onChange={(e) => onChange(e.target.checked)} />
          <span>{field.label}{requiredMark}</span>
        </label>
        {meta}
      </div>
    );
  }

  if (field.type === 'radio' || field.type === 'checkbox') {
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset aria-describedby={describedBy} className="min-w-0 rounded-md border border-[#8b7d72] px-3 py-2">
        <legend className="px-1 font-semibold">{field.label}{requiredMark}</legend>
        {choices.map((choice, index) => (
          <label key={choice.value} className={choiceClass}>
            <input
              id={index === 0 ? id : undefined}
              className={boxClass}
              type={field.type}
              name={field.id}
              value={choice.value}
              checked={field.type === 'radio' ? value === choice.value : selected.includes(choice.value)}
              onChange={(e) => {
                if (field.type === 'radio') onChange(choice.value);
                else onChange(e.target.checked ? [...selected, choice.value] : selected.filter((v) => v !== choice.value));
              }}
            />
            {choice.label}
          </label>
        ))}
        {meta}
      </fieldset>
    );
  }

  const label = <span className="font-semibold">{field.label}{requiredMark}</span>;
  const common = { id, name: field.id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy, className: inputClass };
  const text = typeof value === 'string' ? value : '';

  return (
    <div>
      <label htmlFor={id} className="block">{label}</label>
      {field.type === 'textarea' && <textarea {...common} rows={4} maxLength={2000} value={text} onChange={(e) => onChange(e.target.value)} />}
      {field.type === 'dropdown' && (
        <select {...common} value={text} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select…</option>
          {choices.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      )}
      {(field.type === 'text' || field.type === 'email' || field.type === 'phone' || field.type === 'date') && (
        <input
          {...common}
          type={field.type === 'phone' ? 'tel' : field.type}
          maxLength={field.type === 'email' ? 255 : 200}
          autoComplete={AUTOCOMPLETE[field.id]}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
      {meta}
    </div>
  );
}

const AUTOCOMPLETE: Record<string, string> = {
  first_name: 'given-name', last_name: 'family-name', email: 'email', phone: 'tel', birthdate: 'bday',
};
