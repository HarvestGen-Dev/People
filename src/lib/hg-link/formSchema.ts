// <!-- AGENT: ARCHITECT -->
// Versioned form definition + server-side submission validation.
// Definitions are data only (no executable logic): a fixed set of field types,
// plain-text labels and option lists.
import { z } from 'zod';

export const FORM_DEFINITION_VERSION = 1;

export const FIELD_TYPES = [
  'text', 'textarea', 'email', 'phone', 'date', 'dropdown', 'radio', 'checkbox', 'consent',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Field ids that map onto the core People profile. Everything else stays with the submission. */
export const CORE_FIELD_IDS = ['first_name', 'last_name', 'email', 'phone', 'birthdate', 'gender'] as const;
export type CoreFieldId = (typeof CORE_FIELD_IDS)[number];
const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

const optionSchema = z.object({
  value: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(100),
});

export const fieldSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, 'Use lowercase letters, numbers and underscores'),
  type: z.enum(FIELD_TYPES),
  label: z.string().trim().min(1, 'Add a label').max(160),
  helpText: z.string().trim().max(300).default(''),
  required: z.boolean().default(false),
  hidden: z.boolean().default(false),
  options: z.array(optionSchema).max(50).default([]),
  /** 'lists' = options come from this church's static People lists at render time. */
  optionsSource: z.enum(['inline', 'lists']).default('inline'),
});

export const formDefinitionSchema = z
  .object({
    version: z.literal(FORM_DEFINITION_VERSION).default(FORM_DEFINITION_VERSION),
    submitLabel: z.string().trim().min(1).max(40).default('Submit'),
    successMessage: z.string().trim().min(1).max(400).default('Thank you. Our team will be in touch.'),
    privacyNote: z.string().trim().max(400).default(''),
    fields: z.array(fieldSchema).min(1).max(30),
  })
  .strict()
  .superRefine((definition, ctx) => {
    const ids = new Set<string>();
    definition.fields.forEach((field, index) => {
      const path = ['fields', index];
      if (ids.has(field.id)) ctx.addIssue({ code: 'custom', path: [...path, 'id'], message: 'Duplicate field id' });
      ids.add(field.id);

      const isChoice = field.type === 'dropdown' || field.type === 'radio' || field.type === 'checkbox';
      if (field.type === 'consent' && field.optionsSource === 'lists') {
        ctx.addIssue({ code: 'custom', path: [...path, 'optionsSource'], message: 'Consent fields have no options' });
      }
      if (isChoice && field.optionsSource === 'inline' && field.options.length === 0 && field.type !== 'checkbox') {
        ctx.addIssue({ code: 'custom', path: [...path, 'options'], message: 'Add at least one option' });
      }
      if (!isChoice && (field.options.length > 0 || field.optionsSource === 'lists')) {
        ctx.addIssue({ code: 'custom', path: [...path, 'options'], message: 'Only choice fields have options' });
      }
      if (field.optionsSource === 'lists' && field.type !== 'dropdown') {
        ctx.addIssue({ code: 'custom', path: [...path, 'optionsSource'], message: 'Only dropdowns can use lists' });
      }
      const optionValues = field.options.map((o) => o.value);
      if (new Set(optionValues).size !== optionValues.length) {
        ctx.addIssue({ code: 'custom', path: [...path, 'options'], message: 'Option values must be unique' });
      }
      // Core fields keep a fixed type so they cannot corrupt the People profile.
      const coreType: Partial<Record<string, FieldType[]>> = {
        first_name: ['text'], last_name: ['text'], email: ['email'], phone: ['phone'],
        birthdate: ['date'], gender: ['dropdown', 'radio'],
      };
      const allowed = coreType[field.id];
      if (allowed && !allowed.includes(field.type)) {
        ctx.addIssue({ code: 'custom', path: [...path, 'type'], message: `"${field.id}" must be a ${allowed.join(' or ')} field` });
      }
      if (field.id === 'gender' && field.optionsSource === 'inline'
        && field.options.some((o) => !GENDERS.includes(o.value))) {
        ctx.addIssue({ code: 'custom', path: [...path, 'options'], message: 'Gender values must be male, female, other or prefer_not_to_say' });
      }
    });

    const byId = new Map(definition.fields.map((f) => [f.id, f]));
    for (const id of ['first_name', 'last_name'] as const) {
      const field = byId.get(id);
      if (!field || field.hidden || !field.required) {
        ctx.addIssue({ code: 'custom', path: ['fields'], message: `A visible, required ${id.replace('_', ' ')} field is needed to identify the person` });
      }
    }
    const contact = ['email', 'phone'].map((id) => byId.get(id)).filter((f) => f && !f.hidden);
    if (contact.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['fields'], message: 'Keep an email or phone field visible so staff can follow up' });
    }
  });

export type FormField = z.infer<typeof fieldSchema>;
export type FormDefinition = z.infer<typeof formDefinitionSchema>;

/** Options resolved at render/submit time for fields with optionsSource = 'lists'. */
export type ResolvedOptions = Record<string, { value: string; label: string }[]>;

export type ValidatedSubmission = {
  core: Partial<Record<CoreFieldId, string>>;
  answers: Record<string, string | string[] | boolean>;
};

export type FieldErrors = Record<string, string>;

const PHONE = /^\+?[\d ().-]+$/;

function fieldOptions(field: FormField, resolved: ResolvedOptions) {
  return field.optionsSource === 'lists' ? resolved[field.id] ?? [] : field.options;
}

/**
 * Validate raw submitted values against the published definition.
 * Unknown keys, hidden fields and anything not in the definition are dropped.
 * Used on the server (authoritative) and in the browser (convenience).
 */
export function validateSubmission(
  definition: FormDefinition,
  resolved: ResolvedOptions,
  values: Record<string, unknown>
): { ok: true; data: ValidatedSubmission } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const core: ValidatedSubmission['core'] = {};
  const answers: ValidatedSubmission['answers'] = {};

  for (const field of definition.fields) {
    if (field.hidden) continue;
    const raw = values[field.id];
    const isCoreField = (CORE_FIELD_IDS as readonly string[]).includes(field.id);
    const fail = (message: string) => { errors[field.id] = message; };

    if (field.type === 'consent') {
      const accepted = raw === true;
      if (field.required && !accepted) fail('Please confirm to continue');
      answers[field.id] = accepted;
      continue;
    }

    if (field.type === 'checkbox') {
      const options = fieldOptions(field, resolved);
      if (options.length === 0) {
        // Single yes/no checkbox.
        const checked = raw === true;
        if (field.required && !checked) fail('This is required');
        answers[field.id] = checked;
        continue;
      }
      const selected = Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : [];
      const allowed = new Set(options.map((o) => o.value));
      if (selected.some((v) => !allowed.has(v))) { fail('Choose from the listed options'); continue; }
      if (field.required && selected.length === 0) { fail('Choose at least one option'); continue; }
      answers[field.id] = [...new Set(selected)];
      continue;
    }

    const text = typeof raw === 'string' ? raw.trim() : '';
    if (!text) {
      if (field.required) fail('This is required');
      continue;
    }

    let valid = true;
    switch (field.type) {
      case 'text': valid = text.length <= 200; break;
      case 'textarea': valid = text.length <= 2000; break;
      case 'email': valid = text.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text); break;
      case 'phone': {
        const digits = text.replace(/\D/g, '');
        valid = PHONE.test(text) && digits.length >= 7 && digits.length <= 15 && text.length <= 50;
        break;
      }
      case 'date': valid = /^\d{4}-\d{2}-\d{2}$/.test(text) && !Number.isNaN(Date.parse(text)); break;
      case 'dropdown':
      case 'radio':
        valid = fieldOptions(field, resolved).some((o) => o.value === text);
        break;
    }
    if (!valid) {
      fail(field.type === 'dropdown' || field.type === 'radio' ? 'Choose from the listed options' : 'Check this answer');
      continue;
    }

    const value = field.type === 'email' ? text.toLowerCase() : text;
    if (isCoreField) core[field.id as CoreFieldId] = value;
    else answers[field.id] = value;
  }

  if (core.gender && !GENDERS.includes(core.gender)) errors.gender = 'Choose from the listed options';
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  if (!core.first_name || !core.last_name) {
    return { ok: false, errors: { first_name: 'Name is required' } };
  }
  return { ok: true, data: { core, answers } };
}

/** Default definitions for the four existing HG Link forms. */
export type DefaultFormSeed = {
  slug: string;
  kind: 'newcomer' | 'new_christian' | 'baptism' | 'serve';
  title: string;
  description: string;
  definition: FormDefinition;
};

const names = (): FormField[] => [
  { id: 'first_name', type: 'text', label: 'First name', helpText: '', required: true, hidden: false, options: [], optionsSource: 'inline' },
  { id: 'last_name', type: 'text', label: 'Last name', helpText: '', required: true, hidden: false, options: [], optionsSource: 'inline' },
];
const f = (field: Partial<FormField> & Pick<FormField, 'id' | 'type' | 'label'>): FormField => ({
  helpText: '', required: false, hidden: false, options: [], optionsSource: 'inline', ...field,
});
const yesNo = [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }];

export function defaultFormSeeds(): DefaultFormSeed[] {
  const base = { version: FORM_DEFINITION_VERSION, submitLabel: 'Submit', privacyNote: 'Your details are shared only with the church team who will follow up with you.' } as const;
  return [
    {
      slug: 'new-to-church', kind: 'newcomer', title: 'I’m New To Church!', description: '',
      definition: { ...base, successMessage: 'Welcome! Someone from our team will be in touch soon.', fields: [
        ...names(),
        f({ id: 'email', type: 'email', label: 'Email address', required: true }),
        f({ id: 'phone', type: 'phone', label: 'Phone number', required: true }),
        f({ id: 'invited_by', type: 'text', label: 'Invited by' }),
        f({ id: 'looking_for_church', type: 'radio', label: 'Looking for a church?', options: yesNo }),
        f({ id: 'interested_in_jesus', type: 'radio', label: 'Interested in knowing more about Jesus?', options: yesNo }),
      ] },
    },
    {
      slug: 'became-a-christian', kind: 'new_christian', title: 'I Just Became A Christian', description: '',
      definition: { ...base, successMessage: 'Congratulations on your decision! Our team will reach out to encourage you.', fields: [
        ...names(),
        f({ id: 'email', type: 'email', label: 'Email address', required: true }),
        f({ id: 'phone', type: 'phone', label: 'Phone number' }),
        f({ id: 'contact_method', type: 'radio', label: 'How would you like us to reach you?', required: true,
          options: [{ value: 'email', label: 'Email' }, { value: 'phone', label: 'Phone call' }, { value: 'message', label: 'Text message' }] }),
        f({ id: 'follow_up_consent', type: 'consent', label: 'I agree that the church team may contact me to follow up.', required: true }),
      ] },
    },
    {
      slug: 'water-baptism', kind: 'baptism', title: 'I Want To Be Water Baptised', description: '',
      definition: { ...base, successMessage: 'Thank you! Our team will contact you about the next baptism.', fields: [
        ...names(),
        f({ id: 'email', type: 'email', label: 'Email address', required: true }),
        f({ id: 'phone', type: 'phone', label: 'Phone number' }),
        f({ id: 'gender', type: 'dropdown', label: 'Gender', required: true,
          options: [{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }] }),
        f({ id: 'birthdate', type: 'date', label: 'Birthdate', required: true }),
        f({ id: 'marital_status', type: 'dropdown', label: 'Marital status', required: true,
          options: ['single', 'married', 'widowed', 'separated'].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) }),
        f({ id: 'connect_group', type: 'dropdown', label: 'Connect Group', helpText: 'Choose your group, if you have one.', optionsSource: 'lists' }),
        f({ id: 'baptised_before', type: 'radio', label: 'Have you been baptised before?', required: true, options: yesNo }),
        f({ id: 'baptism_notes', type: 'textarea', label: 'Anything we should know?' }),
        f({ id: 'follow_up_consent', type: 'consent', label: 'I agree that the church team may contact me about my baptism.', required: true }),
      ] },
    },
    {
      slug: 'serve', kind: 'serve', title: 'I Want To Serve', description: '',
      definition: { ...base, successMessage: 'Thank you for wanting to serve! A ministry leader will be in touch.', fields: [
        ...names(),
        f({ id: 'email', type: 'email', label: 'Email', required: true }),
        f({ id: 'phone', type: 'phone', label: 'Phone', required: true }),
        f({ id: 'served_before', type: 'radio', label: 'I have served in another church before', required: true, options: yesNo }),
        f({ id: 'preferred_ministry', type: 'dropdown', label: 'Preferred ministry', required: true,
          options: ['Worship', 'Production', 'Hospitality', 'Ushering', 'Kids Gen', 'Prayer', 'Not sure yet'].map((v) => ({ value: v.toLowerCase().replace(/ /g, '_'), label: v })) }),
        f({ id: 'availability', type: 'checkbox', label: 'Availability',
          options: ['Sunday mornings', 'Sunday afternoons', 'Weekday evenings', 'Saturdays'].map((v) => ({ value: v.toLowerCase().replace(/ /g, '_'), label: v })) }),
        f({ id: 'follow_up_consent', type: 'consent', label: 'I agree that a ministry leader may contact me.', required: true }),
      ] },
    },
  ];
}
